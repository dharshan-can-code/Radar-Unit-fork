"""Live NISAR GCOV discovery for any location, and remote window reading."""
from __future__ import annotations

import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts"), str(ROOT / "scripts" / "processing")]
from config import COLLECTION_MATURITY  # noqa: E402
from gcov_reader import DIAGONAL_TERMS, quality_ok  # noqa: E402

GRID = "/science/LSAR/GCOV/grids/frequencyA"
USABLE = {"PROVISIONAL", "VALIDATED"}  # BETA is pre-calibration: listed, never analysed
_CACHE: dict[str, tuple[float, dict]] = {}
SEARCH_TTL_S = 900


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def maturity_of(collection: str) -> str:
    return COLLECTION_MATURITY.get(collection, "OTHER")


def granule_record(p: dict, geometry: dict) -> dict:
    files = p.get("bytes") or {}
    return {
        "scene": p["sceneName"], "date": p["startTime"][:10], "start_time": p["startTime"],
        "track": p.get("pathNumber"), "frame": p.get("frameNumber"), "direction": p.get("flightDirection"),
        "collection": p.get("collectionName"), "maturity": maturity_of(p.get("collectionName", "")),
        "crid": p.get("crid"), "pols": list(p.get("mainBandPolarization") or []),
        "bandwidth": "+".join(p.get("rangeBandwidth") or []), "frame_coverage": p.get("frameCoverage"),
        "processing_date": p.get("processingDate"), "url": p.get("url"),
        "h5_bytes": files.get(p.get("fileName", ""), {}).get("bytes"), "footprint": geometry,
    }


def stack_key(g: dict) -> str:
    """Compatible = same track, pass, frame, bandwidth mode, processing release (CRID)
    and ASF collection (e.g. NISAR_UR_L2 urgent-response products can share a CRID
    with PROVISIONAL ones but are a different product line)."""
    base = f"t{g['track']}{(g['direction'] or '?')[0]}_f{g['frame']}_{g['bandwidth'].replace('+', '-')}_{g['crid']}"
    return base if g["maturity"] in USABLE else f"{base}_{g['maturity'].lower()}"


def group_stacks(granules: list[dict]) -> list[dict]:
    stacks: dict[str, dict] = {}
    for g in granules:
        k = stack_key(g)
        s = stacks.setdefault(k, {"id": k, "track": g["track"], "direction": g["direction"], "frame": g["frame"],
                                  "bandwidth": g["bandwidth"], "crid": g["crid"], "maturity": g["maturity"],
                                  "usable": g["maturity"] in USABLE, "granules": []})
        s["granules"].append(g)
    out = []
    for s in stacks.values():
        gs = sorted({g["date"]: g for g in s["granules"]}.values(), key=lambda g: g["start_time"])  # one per date
        s["granules"] = gs
        s["dates"] = [g["date"] for g in gs]
        s["n_dates"] = len(gs)
        s["dual_pol_dates"] = [g["date"] for g in gs if "HV" in g["pols"]]
        s["latest"] = gs[-1]["date"] if gs else None
        out.append(s)
    # Most useful first: usable, then most recent latest date, then most dates.
    out.sort(key=lambda s: (s["usable"], s["n_dates"] >= 2, s["latest"] or "", s["n_dates"]), reverse=True)
    return out


def search_point(lat: float, lon: float, use_cache: bool = True) -> dict:
    """Query the ASF archive live for GCOV granules covering a point."""
    key = f"{lat:.4f},{lon:.4f}"
    if use_cache and key in _CACHE and time.time() - _CACHE[key][0] < SEARCH_TTL_S:
        return _CACHE[key][1]
    import asf_search as asf

    res = asf.search(dataset="NISAR", processingLevel="GCOV", intersectsWith=f"POINT({lon} {lat})", maxResults=2000)
    grans = {}
    for r in res:
        g = granule_record(r.properties, r.geometry)
        grans[(g["scene"], g["collection"])] = g  # dedupe
    granules = sorted(grans.values(), key=lambda g: g["start_time"])
    out = {"lat": lat, "lon": lon, "checked_utc": now_utc(),
           "source": "ASF Search API (asf_search), dataset NISAR, processingLevel GCOV",
           "n_granules": len(granules), "stacks": group_stacks(granules)}
    _CACHE[key] = (time.time(), out)
    return out


# ---- remote reading ---------------------------------------------------------

_DATE_RE = re.compile(r"_(\d{8})T(\d{6})")


def scene_epsg(f) -> int:
    pr = f[GRID]["projection"]
    if "epsg_code" in pr.attrs:
        return int(np.asarray(pr.attrs["epsg_code"]).item())
    return int(pr[()])


def read_window(f, pol: str, xlim: tuple, ylim: tuple):
    """Return (x, y, power, usable) for the part of the frequency-A grid inside
    the projected limits, applying the verified GCOV quality masks."""
    g = f[GRID]
    term = DIAGONAL_TERMS[pol]
    if term not in g:
        return None
    x = g["xCoordinates"][()]
    y = g["yCoordinates"][()]
    xi = np.where((x >= xlim[0]) & (x <= xlim[1]))[0]
    yi = np.where((y >= ylim[0]) & (y <= ylim[1]))[0]
    if xi.size == 0 or yi.size == 0:
        return None
    rs, cs = slice(yi.min(), yi.max() + 1), slice(xi.min(), xi.max() + 1)
    p = g[term][rs, cs]
    mk = g["mask"][rs, cs] if "mask" in g else None
    ex = g["inputDataExceptionMask"][rs, cs] if "inputDataExceptionMask" in g else None
    fv = g[term].attrs.get("_FillValue")
    ok = np.isfinite(p) & (p > 0) & quality_ok(mk, ex, pol)
    if fv is not None and np.isfinite(fv):
        ok &= p != fv
    return x[cs], y[rs], p, ok
