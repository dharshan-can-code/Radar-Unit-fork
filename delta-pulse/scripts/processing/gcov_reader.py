"""Read the parts of a NISAR L2 GCOV HDF5 file that DELTA PULSE uses.

Dataset paths follow the NISAR GCOV layout documented by ASF
(/science/LSAR/GCOV/grids/frequencyA/<TERM>, e.g. HHHH). If a path is not
where we expect, the reader searches the file and fails loudly rather than
guessing. Run scripts/inspection/inspect_h5.py on a real file first and
update DEFAULT_PATHS below if the layout differs.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import h5py
import numpy as np

DEFAULT_PATHS = {
    "grid_group": "/science/LSAR/GCOV/grids/frequencyA",
    "identification": "/science/LSAR/identification",
}
DIAGONAL_TERMS = {"HH": "HHHH", "HV": "HVHV", "VV": "VVVV", "VH": "VHVH"}
_DATE_RE = re.compile(r"_(\d{8})T(\d{6})")
_CRID_RE = re.compile(r"_([PX]\d{5})_")


class GCOVLayoutError(RuntimeError):
    pass


@dataclass
class GCOVInfo:
    path: Path
    scene: str
    date: str
    start_time: str
    crid: str | None
    epsg: int
    x: np.ndarray
    y: np.ndarray
    channels: list[str]
    fill_values: dict = field(default_factory=dict)
    identification: dict = field(default_factory=dict)
    synthetic: bool = False


def _find_grid_group(f: h5py.File) -> str:
    if DEFAULT_PATHS["grid_group"] in f:
        return DEFAULT_PATHS["grid_group"]
    hits = []
    f.visititems(lambda n, o: hits.append("/" + n) if isinstance(o, h5py.Group)
                 and n.endswith("frequencyA") and "HHHH" in o else None)
    if len(hits) != 1:
        raise GCOVLayoutError(f"cannot locate frequencyA grid group (found {hits}); run inspect_h5.py")
    return hits[0]


def _epsg(grp: h5py.Group) -> int:
    if "projection" not in grp:
        raise GCOVLayoutError("no 'projection' dataset in grid group; run inspect_h5.py")
    pr = grp["projection"]
    for k in ("epsg_code", "epsg"):
        if k in pr.attrs:
            return int(np.asarray(pr.attrs[k]).item())
    v = pr[()]
    if np.issubdtype(np.asarray(v).dtype, np.integer) and 1024 < int(v) < 100000:
        return int(v)
    raise GCOVLayoutError("cannot determine EPSG from projection dataset; run inspect_h5.py")


def _decode(v):
    v = v[()] if hasattr(v, "shape") else v
    if isinstance(v, bytes):
        return v.decode(errors="replace")
    if isinstance(v, np.ndarray) and v.dtype.kind == "S":
        return [s.decode() for s in v.tolist()]
    return v.item() if isinstance(v, np.generic) else v


def open_info(path: str | Path) -> GCOVInfo:
    path = Path(path)
    m = _DATE_RE.search(path.name)
    if not m:
        raise GCOVLayoutError(f"cannot parse acquisition time from file name {path.name}")
    d, t = m.groups()
    with h5py.File(path, "r") as f:
        g = f[_find_grid_group(f)]
        x = g["xCoordinates"][()].astype(np.float64)
        y = g["yCoordinates"][()].astype(np.float64)
        chans, fills = [], {}
        for pol, term in DIAGONAL_TERMS.items():
            if term in g:
                ds = g[term]
                if np.iscomplexobj(np.empty(0, dtype=ds.dtype)):
                    raise GCOVLayoutError(f"{term} is complex; diagonal terms must be real power")
                chans.append(pol)
                fv = ds.attrs.get("_FillValue")
                fills[pol] = float(np.asarray(fv).item()) if fv is not None else None
        ident = {}
        if DEFAULT_PATHS["identification"] in f:
            for k, v in f[DEFAULT_PATHS["identification"]].items():
                if isinstance(v, h5py.Dataset) and v.size <= 16:
                    ident[k] = _decode(v)
        info = GCOVInfo(
            path=path, scene=path.stem, date=f"{d[:4]}-{d[4:6]}-{d[6:]}",
            start_time=f"{d[:4]}-{d[4:6]}-{d[6:]}T{t[:2]}:{t[2:4]}:{t[4:]}Z",
            crid=(_CRID_RE.search(path.name).group(1) if _CRID_RE.search(path.name) else ident.get("crid")),
            epsg=_epsg(g), x=x, y=y, channels=chans, fill_values=fills,
            identification=ident, synthetic=bool(f.attrs.get("DELTA_PULSE_SYNTHETIC", False)),
        )
    if not info.channels:
        raise GCOVLayoutError("no diagonal covariance terms found")
    return info


def read_window(info: GCOVInfo, pol: str, xlim: tuple, ylim: tuple, row_chunk: int = 512):
    """Yield (x_sub, y_sub, power_block) for the part of the grid inside the
    given projected x/y limits, in row chunks to bound memory."""
    xi = np.where((info.x >= xlim[0]) & (info.x <= xlim[1]))[0]
    yi = np.where((info.y >= ylim[0]) & (info.y <= ylim[1]))[0]
    if xi.size == 0 or yi.size == 0:
        return
    c0, c1 = xi.min(), xi.max() + 1
    r0, r1 = yi.min(), yi.max() + 1
    with h5py.File(info.path, "r") as f:
        ds = f[_find_grid_group(f)][DIAGONAL_TERMS[pol]]
        for r in range(r0, r1, row_chunk):
            re_ = min(r + row_chunk, r1)
            yield info.x[c0:c1], info.y[r:re_], ds[r:re_, c0:c1]
