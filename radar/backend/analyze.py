"""On-demand analysis of NISAR GCOV acquisitions around any location.

Output has exactly the same format as the batch pipeline
(manifest.json + grid.bin + img/*.png), so the web app can show either.
"""
from __future__ import annotations

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts"), str(ROOT / "scripts" / "processing"), str(Path(__file__).parent)]
import radar  # noqa: E402
from process_stack import (CHANGE_RANGE, SCREENING, STRETCH, _rgba_change, _rgba_class, _rgba_gray,  # noqa: E402
                           _save, corners_lonlat)
from nisar import read_window, scene_epsg  # noqa: E402
from remote_h5 import RemoteFile  # noqa: E402

MAX_SIZE_KM = 40
MAX_SCENES = 12


class AnalysisError(ValueError):
    pass


def validate_request(granules: list[dict], size_km: float):
    if not 2 <= len(granules) <= MAX_SCENES:
        raise AnalysisError(f"choose between 2 and {MAX_SCENES} acquisitions")
    if not 2 <= size_km <= MAX_SIZE_KM:
        raise AnalysisError(f"window size must be 2-{MAX_SIZE_KM} km")
    keys = {(g["track"], g["direction"], g["frame"], g["bandwidth"], g["crid"], g["collection"]) for g in granules}
    if len(keys) != 1:
        raise AnalysisError("acquisitions must come from one compatible stack "
                            "(same track, pass, frame, bandwidth and processing release)")
    bad = [g["date"] for g in granules if g["maturity"] not in ("PROVISIONAL", "VALIDATED")]
    if bad:
        raise AnalysisError(f"pre-calibration (BETA/other) products are not analysed: {bad}")
    if len({g["date"] for g in granules}) != len(granules):
        raise AnalysisError("duplicate acquisition dates")


def window_grid(lat, lon, size_km, epsg):
    """Square window centred on the point, in the scene's UTM CRS."""
    res = float(max(40.0, round(size_km * 1000 / 500 / 20) * 20))  # <= ~500 px, multiple of native 20 m
    cx, cy = Transformer.from_crs(4326, epsg, always_xy=True).transform(lon, lat)
    half = size_km * 500.0
    x0 = np.floor((cx - half) / res) * res
    y1 = np.ceil((cy + half) / res) * res
    n = int(round(2 * half / res))
    return x0, y1, res, n, n


def run_analysis(out: Path, lat: float, lon: float, size_km: float, granules: list[dict], token: str,
                 place: str | None = None, progress=lambda msg, frac: None,
                 result_id: str | None = None) -> dict:
    validate_request(granules, size_km)
    granules = sorted(granules, key=lambda g: g["start_time"])
    (out / "img").mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    min_vf = SCREENING["min_valid_fraction"]["value"]
    stats = {"bytes_fetched": 0, "requests": 0}

    # Open the first scene to fix the grid (all scenes of a stack share the frame CRS).
    progress("Connecting to the NASA ASF archive", 0.02)
    first = RemoteFile(granules[0]["url"], token)
    with h5py.File(first, "r") as f:
        epsg = scene_epsg(f)
    x0, y1, res, nx, ny = window_grid(lat, lon, size_km, epsg)
    progress(f"Reading {len(granules)} acquisitions from NASA's archive in parallel (~30-60 s each)", 0.05)
    xlim = (x0 - res, x0 + nx * res + res)
    ylim = (y1 - ny * res - res, y1 + res)

    def process(idx_g):
        idx, g = idx_g
        rf = first if idx == 0 else RemoteFile(g["url"], token)
        dbs, vfs = {}, {}
        with h5py.File(rf, "r") as f:
            if scene_epsg(f) != epsg:
                raise AnalysisError(f"{g['date']} is in a different projection; cannot align")
            for pol in ("HH", "HV"):
                w = read_window(f, pol, xlim, ylim)
                if w is None:
                    continue
                acc = radar.GridAccumulator(x0, y1, res, nx, ny)
                acc.add(*w)
                p, vf = acc.mean(), acc.valid_fraction()
                p[vf < min_vf] = np.nan
                dbs[pol], vfs[pol] = radar.to_db(p), vf
        return idx, g, dbs, vfs, rf.bytes_fetched, rf.n_requests

    results = [None] * len(granules)
    done = 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        for idx, g, dbs, vfs, nb, nr in ex.map(process, enumerate(granules)):
            results[idx] = (g, dbs, vfs)
            stats["bytes_fetched"] += nb
            stats["requests"] += nr
            done += 1
            progress(f"Read {g['date']} ({done}/{len(granules)})", 0.05 + 0.85 * done / len(granules))

    obs, grids = [], []
    for g, dbs, vfs in results:
        if "HH" not in dbs or not np.isfinite(dbs["HH"]).any():
            raise AnalysisError(f"no valid radar data at this location on {g['date']} "
                                "(outside the swath or masked)")
        for pol, d in dbs.items():
            _save(_rgba_gray(d, *STRETCH[pol]), out / "img" / f"{g['date']}_{pol}.png")
        cls = radar.screen(dbs["HH"], dbs.get("HV"), SCREENING)
        _save(_rgba_class(cls), out / "img" / f"{g['date']}_class.png")
        valid = np.isfinite(dbs["HH"])
        obs.append({"id": g["date"], "date": g["date"], "start_time": g["start_time"], "scene": g["scene"],
                    "crid": g["crid"], "epsg": epsg, "channels": [c for c in ("HH", "HV") if c in dbs],
                    "track": g["track"], "frame": g["frame"], "direction": g["direction"],
                    "maturity": g["maturity"], "collection": g["collection"],
                    "valid_fraction": round(float(valid.mean()), 4),
                    "screening_counts": {"low_backscatter": int((cls == radar.LOW_BACKSCATTER).sum()),
                                         "double_bounce": int((cls == radar.DOUBLE_BOUNCE).sum()),
                                         "valid_cells": int(valid.sum())},
                    "cell_area_km2": (res / 1000) ** 2, "downloaded_utc": None,
                    "read_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        grids.append(dbs)

    progress("Computing changes", 0.93)
    sig = SCREENING["change"]["significant_db"]["value"]
    pairs = []
    for a, b, ga, gb in zip(obs, obs[1:], grids, grids[1:]):
        pid = f"{a['date']}_{b['date']}"
        dd = (date.fromisoformat(b["date"]) - date.fromisoformat(a["date"])).days
        pr = {"id": pid, "before": a["date"], "after": b["date"], "delta_days": dd, "nominal_repeat": dd == 12,
              "channels": [c for c in ("HH", "HV") if c in ga and c in gb]}
        for pol in pr["channels"]:
            d = radar.change_db(ga[pol], gb[pol])
            _save(_rgba_change(d), out / "img" / f"d_{pid}_{pol}.png")
            fin = d[np.isfinite(d)]
            pr[f"{pol}_change"] = {"mean_db": float(fin.mean()) if fin.size else None,
                                   "frac_increase": float((fin >= sig).mean()) if fin.size else None,
                                   "frac_decrease": float((fin <= -sig).mean()) if fin.size else None}
        pairs.append(pr)

    # Inspection grid at full window resolution (same layout as the batch pipeline).
    grid = np.full((len(obs), 3, ny, nx), -32768, np.int16)
    for oi, dbs in enumerate(grids):
        for ci, pol in enumerate(("HH", "HV")):
            if pol in dbs:
                d = dbs[pol]
                grid[oi, ci] = np.where(np.isfinite(d), np.round(d * 100), -32768).astype(np.int16)
        grid[oi, 2] = np.round(np.isfinite(dbs["HH"]) * 10000).astype(np.int16)
    grid.tofile(out / "grid.bin")

    tr = Transformer.from_crs(epsg, 4326, always_xy=True)
    lon0, lat0 = tr.transform(x0, y1 - ny * res)
    lon1, lat1 = tr.transform(x0 + nx * res, y1)
    manifest = {
        "area": "live", "stack": result_id or out.name, "name": place or f"{lat:.4f}°, {lon:.4f}°",
        "bbox": [round(lon0, 5), round(lat0, 5), round(lon1, 5), round(lat1, 5)],
        "center": [lon, lat], "size_km": size_km,
        "is_demonstration": False, "demonstration_note": None,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "epsg": epsg,
        "display": {"res_m": res, "nx": nx, "ny": ny, "x0": x0, "y1": y1,
                    "corners": corners_lonlat(x0, y1, res, nx, ny, epsg)},
        "grid": {"file": "grid.bin", "dtype": "int16", "scale": 0.01, "nodata": -32768,
                 "shape": [len(obs), 3, ny, nx], "channels": ["HH_db", "HV_db", "valid_frac_x1e4"],
                 "res_m": res, "x0": x0, "y1": y1},
        "stretch_db": STRETCH, "change_range_db": CHANGE_RANGE, "screening": SCREENING,
        "observations": obs, "pairs": pairs,
        "processing": {"steps": [
            "live ASF search for NISAR L2 GCOV covering the point",
            "HTTP range reads of the frequency-A HHHH/HVHV window (no full download)",
            "exclude non-finite, <=0, mask 0/255 and inputDataExceptionMask samples",
            f"bin onto a common {res:.0f} m grid in EPSG:{epsg} by mean linear power",
            f"drop cells with valid fraction < {min_vf}",
            "dB = 10*log10(power); change = dB(after) - dB(before), consecutive dates",
            "screening rules from screening.json (UNCALIBRATED)"],
            "script": "backend/analyze.py",
            "elapsed_s": round(time.time() - t0, 1),
            "bytes_fetched": stats["bytes_fetched"], "range_requests": stats["requests"]},
    }
    # manifest.json is written last and atomically: its presence marks a complete result.
    tmp = out / "manifest.json.tmp"
    tmp.write_text(json.dumps(manifest, indent=1, default=str))
    for attempt in range(10):  # Windows/OneDrive can hold a fresh file briefly
        try:
            os.replace(tmp, out / "manifest.json")
            break
        except PermissionError:
            time.sleep(0.5 * (attempt + 1))
    else:
        raise IOError("could not finalise manifest.json")
    progress("Done", 1.0)
    return manifest
