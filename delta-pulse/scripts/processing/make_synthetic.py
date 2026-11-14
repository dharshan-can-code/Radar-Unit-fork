"""Generate SYNTHETIC GCOV-like HDF5 fixtures.

PURPOSE: test the pipeline and let the team build the interface before
Earthdata access is set up. These files are NOT NISAR data. Every file
carries the root attribute DELTA_PULSE_SYNTHETIC=1, its name starts with
SYNTHETIC_, and the pipeline propagates is_demonstration=true to the app,
which shows a permanent "DEMONSTRATION DATA" banner.

The fake scene is a growing ellipse of "open water" with a ring of
"flooded vegetation" around it over the Tonle Sap area. It does not
reproduce the real lake shape or real backscatter values.

Run:  .venv/Scripts/python scripts/processing/make_synthetic.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import RAW, STUDY_AREAS  # noqa: E402

# Cadence mirrors the real track-83 stack (incl. the 24-day gap) so the
# interface can be tested against realistic irregular sampling.
DATES = ["20260619", "20260701", "20260713", "20260725", "20260818",
         "20260830", "20260911", "20260923", "20261005", "20261017"]
EPSG = 32648  # UTM 48N


def db2p(db):
    return 10 ** (db / 10)


def make(out_dir: Path, posting=60.0, dates=DATES, seed=0, hv_missing=()):
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = STUDY_AREAS["tonle_sap"]["bbox"]
    tr = Transformer.from_crs(4326, EPSG, always_xy=True)
    X0, Y0 = tr.transform(x0 - 0.05, y0 - 0.05)
    X1, Y1 = tr.transform(x1 + 0.05, y1 + 0.05)
    x = np.arange(X0, X1, posting) + posting / 2
    y = np.arange(Y1, Y0, -posting) - posting / 2
    XX, YY = np.meshgrid(x, y)
    cx, cy = tr.transform(104.05, 12.88)
    ang = np.deg2rad(-38)
    u = (XX - cx) * np.cos(ang) - (YY - cy) * np.sin(ang)
    v = (XX - cx) * np.sin(ang) + (YY - cy) * np.cos(ang)
    field_noise = rng.normal(0, 1.0, XX.shape)
    paths = []
    for t, d in enumerate(dates):
        s = t / (len(dates) - 1)
        a, b = 38e3 + 32e3 * s, 13e3 + 14e3 * s
        r = np.sqrt((u / a) ** 2 + (v / b) ** 2)
        water = r < 1
        flooded = (r >= 1) & (r < 1.25 + 0.15 * s)
        forest = (r >= 1.25 + 0.15 * s) & (r < 1.6)
        hh = np.full(XX.shape, -12.0 + 3 * s) + field_noise   # fields: crop growth
        hv = np.full(XX.shape, -20.0 + 4 * s) + field_noise
        hh[forest], hv[forest] = -8.0, -13.0
        hh[flooded], hv[flooded] = -2.0, -12.5
        hh[water], hv[water] = -22.0, -30.0
        looks = 6
        hhp = db2p(hh) * rng.gamma(looks, 1 / looks, XX.shape)
        hvp = db2p(hv) * rng.gamma(looks, 1 / looks, XX.shape)
        edge = XX < X0 + 3000 + 2000 * np.sin(YY / 9000)  # swath edge -> NaN
        hhp[edge] = np.nan
        hvp[edge] = np.nan
        name = f"SYNTHETIC_GCOV_083_A_008_{d}T223000_X00000_DEMO.h5"
        p = out_dir / name
        with h5py.File(p, "w") as f:
            f.attrs["DELTA_PULSE_SYNTHETIC"] = 1
            f.attrs["description"] = "Synthetic fixture. NOT NISAR data."
            g = f.create_group("/science/LSAR/GCOV/grids/frequencyA")
            g.create_dataset("xCoordinates", data=x)
            g.create_dataset("yCoordinates", data=y)
            pr = g.create_dataset("projection", data=np.uint32(EPSG))
            pr.attrs["epsg_code"] = EPSG
            g.create_dataset("HHHH", data=hhp.astype(np.float32), compression="gzip", compression_opts=1)
            if d not in hv_missing:
                g.create_dataset("HVHV", data=hvp.astype(np.float32), compression="gzip", compression_opts=1)
            idg = f.create_group("/science/LSAR/identification")
            idg["trackNumber"] = 83
            idg["frameNumber"] = 8
            idg["orbitPassDirection"] = np.bytes_("Ascending")
        paths.append(p)
    return paths


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(RAW / "synthetic"))
    ap.add_argument("--posting", type=float, default=60.0)
    a = ap.parse_args()
    for p in make(Path(a.out), a.posting):
        print(p)
