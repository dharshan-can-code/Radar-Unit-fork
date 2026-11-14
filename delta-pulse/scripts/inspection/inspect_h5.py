"""Inspect the structure of a NISAR GCOV HDF5 file BEFORE trusting any
processing code against it.

Prints and saves (data/metadata/h5_structure_<file>.json):
  - every group/dataset path, shape, dtype, and attributes
  - frequency groups and the polarisation / covariance-term lists
  - projection (EPSG), pixel spacing, fill values
  - summary statistics of a small central window of each diagonal term,
    which tells you whether the values look like linear power (all >= 0,
    mostly << 1) or something else (e.g. dB, which is negative).

Run:  .venv/Scripts/python scripts/inspection/inspect_h5.py data/raw/tonle_sap/<file>.h5
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import h5py
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import METADATA  # noqa: E402


def _attr(v):
    if isinstance(v, bytes):
        return v.decode(errors="replace")
    if isinstance(v, np.ndarray):
        return [_attr(x) for x in v.tolist()] if v.size < 50 else f"<array {v.shape}>"
    if isinstance(v, (np.generic,)):
        return v.item()
    return v


def walk(f: h5py.File) -> list[dict]:
    items = []

    def visit(name, obj):
        rec = {"path": "/" + name, "kind": "group" if isinstance(obj, h5py.Group) else "dataset",
               "attrs": {k: _attr(v) for k, v in obj.attrs.items()}}
        if isinstance(obj, h5py.Dataset):
            rec.update(shape=list(obj.shape), dtype=str(obj.dtype))
            if obj.size <= 16:
                try:
                    rec["value"] = _attr(obj[()])
                except Exception:  # noqa: BLE001
                    pass
        items.append(rec)

    f.visititems(visit)
    return items


def window_stats(ds: h5py.Dataset, size=512) -> dict:
    ny, nx = ds.shape[-2:]
    cy, cx = ny // 2, nx // 2
    a = ds[max(cy - size // 2, 0): cy + size // 2, max(cx - size // 2, 0): cx + size // 2]
    out = {"dtype": str(a.dtype), "is_complex": bool(np.iscomplexobj(a))}
    if np.iscomplexobj(a):
        a = np.abs(a)
        out["note"] = "complex term: statistics of |value|; NOT an intensity"
    fin = np.isfinite(a)
    v = a[fin]
    out.update(n=int(a.size), frac_finite=float(fin.mean()),
               frac_le_zero=float((v <= 0).mean()) if v.size else None,
               min=float(v.min()) if v.size else None,
               p50=float(np.median(v)) if v.size else None,
               max=float(v.max()) if v.size else None)
    if v.size:
        if (v < 0).mean() > 0.5:
            out["representation_guess"] = "mostly negative: possibly already dB - CHECK attributes"
        else:
            out["representation_guess"] = "non-negative: consistent with linear power"
    return out


def summarize(items: list[dict], f: h5py.File) -> dict:
    s: dict = {"frequency_groups": [], "diagonal_terms": {}, "off_diagonal_terms": {}, "projection": None}
    for it in items:
        p = it["path"]
        if it["kind"] == "group" and p.rstrip("/").split("/")[-1].startswith("frequency") and "/grids/" in p:
            s["frequency_groups"].append(p)
        name = p.split("/")[-1]
        if it["kind"] == "dataset" and len(name) == 4 and name.isupper() and "/grids/" in p:
            key = "diagonal_terms" if name[:2] == name[2:] else "off_diagonal_terms"
            s[key][p] = window_stats(f[p])
        if name in ("listOfPolarizations", "listOfCovarianceTerms") and "value" in it:
            s.setdefault(name, {})[p] = it["value"]
        if name == "projection":
            s["projection"] = {"path": p, "attrs": it["attrs"], "value": it.get("value")}
        if name in ("xCoordinateSpacing", "yCoordinateSpacing") and "value" in it:
            s.setdefault("spacing", {})[p] = it["value"]
        if name in ("zeroDopplerStartTime", "trackNumber", "frameNumber", "orbitPassDirection",
                    "productVersion", "processingType", "isFullFrame", "listOfFrequencies") and "value" in it:
            s.setdefault("identification", {})[name] = it["value"]
    return s


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    args = ap.parse_args(argv)
    METADATA.mkdir(parents=True, exist_ok=True)
    for fn in args.files:
        with h5py.File(fn, "r") as f:
            items = walk(f)
            summary = summarize(items, f)
            synthetic = bool(f.attrs.get("DELTA_PULSE_SYNTHETIC", False))
        report = {"file": Path(fn).name, "synthetic_fixture": synthetic, "summary": summary, "tree": items}
        out = METADATA / f"h5_structure_{Path(fn).stem}.json"
        out.write_text(json.dumps(report, indent=2, default=str))
        print(f"== {Path(fn).name}{'  [SYNTHETIC FIXTURE]' if synthetic else ''}")
        print(json.dumps(summary, indent=2, default=str))
        print(f"full tree -> {out}")


if __name__ == "__main__":
    main()
