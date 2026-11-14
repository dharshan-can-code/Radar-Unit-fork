"""Independent checks of the DELTA PULSE screening for a processed case study.

Compares the radar screening classes (from public/data/<area>/<stack>/grid.bin)
with data that were NOT used to make them:

  1. JRC Global Surface Water occurrence (Pekel et al. 2016, v1.4, 1984-2021,
     Landsat): does the "water-like" class find permanent water, and does it
     stay quiet on land that has never been seen wet?
  2. ERA5 10 m wind speed at each pass time (Open-Meteo): wind roughens open
     water and can hide it from the radar.
  3. GloFAS v4 modelled river discharge on each pass date (Open-Meteo Flood
     API): does the radar's water area rise and fall with the river?

Writes public/data/<area>/validation.json, which the app shows under Methods.
Nothing here changes the radar products or the screening thresholds.

Run (from the radar folder):
  .venv/Scripts/python scripts/validation/validate_area.py --area tonle_sap
The JRC tile (~97 MB) is downloaded once into data/reference/jrc/ (git-ignored).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import DATA, STUDY_AREAS, WEB_DATA  # noqa: E402

JRC_BASE = "https://storage.googleapis.com/global-surface-water/downloads2021/occurrence"
JRC_DIR = DATA / "reference" / "jrc"
JRC_RES = 0.00025  # degrees per pixel (~27 m)
JRC_NODATA = 255

# Reference river points, chosen before looking at the result.
RIVER_POINTS = {
    "tonle_sap": [
        {"name": "Mekong at Kratie", "lat": 12.488, "lon": 106.019,
         "why": "Standard reference station for the Mekong flood that pushes water up into Tonle Sap."},
        {"name": "Tonle Sap River near Prek Kdam", "lat": 11.810, "lon": 104.800,
         "why": "The river that connects the lake to the Mekong; it reverses direction in the wet season."},
    ],
}
WINDY_MS = 5.0  # above ~5 m/s, L-band open-water returns often rise above simple dark-water thresholds


# ---- JRC tile reading (Pillow cannot read one window of a tiled GeoTIFF) -----

def lzw_decode(data: bytes) -> bytes:
    """TIFF-flavour LZW (MSB-first codes, 9-12 bits, early change)."""
    out = bytearray()
    table = [bytes([i]) for i in range(256)] + [b"", b""]
    nbits, bitpos, prev = 9, 0, None
    nbitstotal = len(data) * 8
    padded = data + b"\0\0\0"
    while bitpos + nbits <= nbitstotal:
        i = bitpos >> 3
        chunk = (padded[i] << 16) | (padded[i + 1] << 8) | padded[i + 2]
        code = (chunk >> (24 - (bitpos & 7) - nbits)) & ((1 << nbits) - 1)
        bitpos += nbits
        if code == 256:  # clear
            del table[258:]
            nbits, prev = 9, None
            continue
        if code == 257:  # end of information
            break
        if prev is None:
            entry = table[code]
        elif code < len(table):
            entry = table[code]
            table.append(prev + entry[:1])
        else:
            entry = prev + prev[:1]
            table.append(entry)
        out += entry
        prev = entry
        if len(table) + 1 >= (1 << nbits) and nbits < 12:
            nbits += 1
    return bytes(out)


def jrc_tile_name(lon: float, lat: float) -> str:
    lon0 = int(math.floor(lon / 10) * 10)
    lat0 = int(math.ceil(lat / 10) * 10)
    ew = f"{abs(lon0)}{'E' if lon0 >= 0 else 'W'}"
    ns = f"{abs(lat0)}{'N' if lat0 >= 0 else 'S'}"
    return f"occurrence_{ew}_{ns}v1_4_2021.tif"


def read_jrc_window(bbox) -> tuple[np.ndarray, float, float, str]:
    """Occurrence (0-100 %, 255 = no data) for a lon/lat box inside one 10x10 degree tile."""
    w, s, e, n = bbox
    name = jrc_tile_name(w, n)
    if name != jrc_tile_name(e - 1e-9, s + 1e-9):
        raise SystemExit("study area crosses a JRC tile boundary; not supported")
    path = JRC_DIR / name
    if not path.exists():
        JRC_DIR.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name} (~100 MB) from {JRC_BASE}")
        tmp = path.with_suffix(".part")
        with urllib.request.urlopen(f"{JRC_BASE}/{name}", timeout=120) as r, open(tmp, "wb") as fh:
            while b := r.read(1 << 20):
                fh.write(b)
        tmp.replace(path)
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    tag = im.tag_v2
    if tag[259] != 5 or tag.get(317, 1) != 1 or tag[258] != (8,):
        raise SystemExit("unexpected JRC tile encoding (expected 8-bit LZW, no predictor)")
    tw, th = tag[322], tag[323]
    offsets, counts = tag[324], tag[325]
    lon_origin, lat_origin = tag[33922][3], tag[33922][4]
    width = im.size[0]
    tiles_across = -(-width // tw)
    c0 = int((w - lon_origin) / JRC_RES)
    c1 = int(math.ceil((e - lon_origin) / JRC_RES))
    r0 = int((lat_origin - n) / JRC_RES)
    r1 = int(math.ceil((lat_origin - s) / JRC_RES))
    out = np.full((r1 - r0, c1 - c0), JRC_NODATA, np.uint8)
    with open(path, "rb") as fh:
        for tr in range(r0 // th, (r1 - 1) // th + 1):
            for tc in range(c0 // tw, (c1 - 1) // tw + 1):
                k = tr * tiles_across + tc
                fh.seek(offsets[k])
                raw = lzw_decode(fh.read(counts[k]))
                if len(raw) != tw * th:
                    raise SystemExit(f"JRC tile {k} decoded to {len(raw)} bytes, expected {tw * th}")
                t = np.frombuffer(raw, np.uint8).reshape(th, tw)
                ys, xs = tr * th, tc * tw
                a0, a1 = max(ys, r0), min(ys + th, r1)
                b0, b1 = max(xs, c0), min(xs + tw, c1)
                out[a0 - r0:a1 - r0, b0 - c0:b1 - c0] = t[a0 - ys:a1 - ys, b0 - xs:b1 - xs]
    bad = (out > 100) & (out != JRC_NODATA)
    if bad.any():
        raise SystemExit(f"JRC values out of range in {bad.sum()} pixels; decoder problem")
    west = lon_origin + c0 * JRC_RES
    north = lat_origin - r0 * JRC_RES
    return out, west, north, name


def jrc_on_grid(m: dict, occ: np.ndarray, west: float, north: float, sub: int = 5):
    """Sample JRC occurrence on a sub x sub lattice inside every 200 m grid cell."""
    g = m["grid"]
    _, _, ny, nx = g["shape"]
    res = g["res_m"]
    off = (np.arange(sub) + 0.5) / sub * res
    xs = g["x0"] + (np.arange(nx)[:, None] * res + off[None, :]).ravel()          # nx*sub
    ys = g["y1"] - (np.arange(ny)[:, None] * res + off[None, :]).ravel()          # ny*sub
    X, Y = np.meshgrid(xs, ys)
    lon, lat = Transformer.from_crs(m["epsg"], 4326, always_xy=True).transform(X, Y)
    ci = np.floor((lon - west) / JRC_RES).astype(np.int64)
    ri = np.floor((north - lat) / JRC_RES).astype(np.int64)
    inside = (ci >= 0) & (ci < occ.shape[1]) & (ri >= 0) & (ri < occ.shape[0])
    v = np.full(X.shape, JRC_NODATA, np.uint8)
    v[inside] = occ[ri[inside], ci[inside]]
    v = v.reshape(ny, sub, nx, sub).transpose(0, 2, 1, 3).reshape(ny, nx, sub * sub)
    nodata = (v == JRC_NODATA).any(axis=2)
    vf = v.astype(np.float32)
    return {
        "permanent": ~nodata & (v >= 90).all(axis=2),     # water in >= 90 % of 1984-2021 observations, whole cell
        "never": ~nodata & (v == 0).all(axis=2),          # never seen as water, whole cell
        "mean": np.where(nodata, np.nan, vf.mean(axis=2)),
        "nodata": nodata,
    }


def distance_km(mask: np.ndarray, res_m: float, max_steps: int = 400) -> np.ndarray:
    """Approximate distance (km) from every cell to the nearest True cell (8-neighbour dilation)."""
    dist = np.full(mask.shape, np.inf)
    dist[mask] = 0
    cur = mask.copy()
    h, w = mask.shape
    for k in range(1, max_steps + 1):
        p = np.pad(cur, 1)
        nb = np.zeros_like(cur)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nb |= p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        new = nb & ~np.isfinite(dist)
        if not new.any():
            break
        dist[new] = k * res_m / 1000
        cur = nb
    return dist


DIST_BANDS = [("0-5 km", 0, 5), ("5-10 km", 5, 10), ("10-20 km", 10, 20), ("20-40 km", 20, 40), ("over 40 km", 40, np.inf)]


# ---- radar classes (same rules as lib/data.ts classify) ----------------------

def load_grid(area: str, stack: str):
    d = WEB_DATA / area / stack
    m = json.loads((d / "manifest.json").read_text())
    g = m["grid"]
    raw = np.fromfile(d / g["file"], np.int16).reshape(g["shape"])
    db = np.where(raw == g["nodata"], np.nan, raw * g["scale"]).astype(np.float32)
    return m, db[:, 0], db[:, 1]


def classify(hh, hv, s, hh_max=None):
    ow, dbl = s["open_water"], s["double_bounce"]
    hh_max = ow["hh_max_db"]["value"] if hh_max is None else hh_max
    fin = np.isfinite(hh)
    hv_ok = ~np.isfinite(hv) | (hv < ow["hv_max_db"]["value"])
    water = fin & (hh < hh_max) & hv_ok
    double = fin & ~water & np.isfinite(hv) & (hh > dbl["hh_min_db"]["value"]) & \
        ((hh - hv) > dbl["hh_minus_hv_min_db"]["value"])
    return water, double, fin


# ---- weather and river context (Open-Meteo, free, no key) -------------------

def pass_hour(start_time: str) -> str:
    t = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    t = (t + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)
    return t.strftime("%Y-%m-%dT%H:00")


def get_json(url: str, params: dict):
    """HTTPS GET via the standard library, which uses the operating system's certificate store."""
    q = urllib.parse.urlencode({k: (",".join(map(str, v)) if isinstance(v, (list, tuple)) else v) for k, v in params.items()})
    with urllib.request.urlopen(f"{url}?{q}", timeout=60) as r:
        return json.loads(r.read())


def wind_at_passes(lat, lon, obs):
    days = [o["date"] for o in obs]
    js = get_json("https://archive-api.open-meteo.com/v1/archive", {
        "latitude": round(lat, 3), "longitude": round(lon, 3), "start_date": min(days),
        "end_date": (datetime.fromisoformat(max(days)) + timedelta(days=1)).strftime("%Y-%m-%d"),
        "hourly": "wind_speed_10m", "wind_speed_unit": "ms", "timezone": "UTC"})
    h = js["hourly"]
    by = dict(zip(h["time"], h["wind_speed_10m"]))
    return [by.get(pass_hour(o["start_time"])) for o in obs]


def discharge_on(lat, lon, dates, search_deg=0.1, step=0.05):
    """GloFAS discharge on the given dates. GloFAS is a ~5 km grid, so a gauge's exact coordinates
    can fall on a small side stream; use the cell with the largest mean flow within +/- search_deg
    (the main channel)."""
    offs = np.arange(-search_deg, search_deg + 1e-9, step)
    lats = [round(lat + dy, 3) for dy in offs for _ in offs]
    lons = [round(lon + dx, 3) for _ in offs for dx in offs]
    js = get_json("https://flood-api.open-meteo.com/v1/flood", {
        "latitude": lats, "longitude": lons, "daily": "river_discharge",
        "start_date": min(dates), "end_date": max(dates)})
    js = js if isinstance(js, list) else [js]
    best = max(js, key=lambda c: np.nanmean([np.nan if v is None else v for v in c["daily"]["river_discharge"]] or [np.nan]))
    by = dict(zip(best["daily"]["time"], best["daily"]["river_discharge"]))
    return [by.get(d) for d in dates], [best.get("latitude"), best.get("longitude")]


def pearson(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 4:
        return None
    return float(np.corrcoef(a[ok], b[ok])[0, 1])


def spearman(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 4:
        return None
    rank = lambda x: np.argsort(np.argsort(x)).astype(float)  # noqa: E731  (no ties expected)
    return pearson(rank(a[ok]), rank(b[ok]))


def r2(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 3)


# ---- main ----------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--area", default="tonle_sap")
    ap.add_argument("--stack", default=None, help="stack id (default: the area's default stack)")
    a = ap.parse_args()

    area = a.area
    stacks = json.loads((WEB_DATA / area / "stacks.json").read_text())
    stack = a.stack or stacks["default"]
    m, HH, HV = load_grid(area, stack)
    s = m["screening"]
    obs = m["observations"]
    dates = [o["date"] for o in obs]
    cell_km2 = (m["grid"]["res_m"] / 1000) ** 2
    bbox = STUDY_AREAS[area]["bbox"]
    clat, clon = (bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2

    print(f"{area}/{stack}: {len(obs)} observations, grid {HH.shape[1:]} at {m['grid']['res_m']} m")
    occ, west, north, tile = read_jrc_window(bbox)
    ref = jrc_on_grid(m, occ, west, north)
    perm, never = ref["permanent"], ref["never"]
    sometimes = ~ref["nodata"] & ~perm & ~never & (ref["mean"] >= 5) & (ref["mean"] < 75)
    print(f"JRC {tile}: permanent-water cells {perm.sum()}, never-water cells {never.sum()}, sometimes-water cells {sometimes.sum()}")

    allvalid = np.isfinite(HH).all(axis=0)
    per_date = []
    for k, o in enumerate(obs):
        water, double, fin = classify(HH[k], HV[k], s)
        P, N, S = perm & fin, never & fin, sometimes & fin
        per_date.append({
            "date": o["date"],
            "water_found_in_permanent": r2(water[P].mean()) if P.any() else None,
            "water_flagged_on_never_water_land": r2(water[N].mean()) if N.any() else None,
            "flooded_veg_on_never_water_land": r2(double[N].mean()) if N.any() else None,
            "flooded_veg_in_sometimes_water": r2(double[S].mean()) if S.any() else None,
            "water_km2": round(float((water & allvalid).sum() * cell_km2), 1),
            "flooded_veg_km2": round(float((double & allvalid).sum() * cell_km2), 1),
        })

    # Where does the flooded-vegetation signature appear? On land Landsat has never seen wet, a real
    # flood under canopy should concentrate near the lake; crops or wet leaves would not care.
    dist = distance_km(perm, m["grid"]["res_m"])
    first_veg = classify(HH[0], HV[0], s)[1]
    peak_k = int(np.argmax([d["flooded_veg_km2"] for d in per_date]))
    peak_veg = classify(HH[peak_k], HV[peak_k], s)[1]
    by_distance = []
    for label, lo, hi in DIST_BANDS:
        band = (dist > lo) & (dist <= hi)
        nb = band & never
        shares = []
        for k in range(len(obs)):
            _, double, fin = classify(HH[k], HV[k], s)
            shares.append(r2(double[nb & fin].mean()) if (nb & fin).any() else None)
        by_distance.append({"band": label, "never_wet_cells": int(nb.sum()), "flooded_veg_share_never_wet": shares,
                            "new_flooded_veg_km2": round(float((peak_veg & ~first_veg & band & allvalid).sum() * cell_km2), 1)})

    # Featured example region for the app: the 10 x 10 km box, mostly on land 5-20 km from permanent
    # water (the flooded-forest belt), where the flooded-vegetation share rose most from the first pass
    # to its peak; and the consecutive pair with the biggest rise there. Chosen BY the radar signal, so it
    # is a showcase, not a statistic.
    B = int(round(10_000 / m["grid"]["res_m"]))
    vegs = np.array([classify(HH[k], HV[k], s)[1] for k in range(len(obs))], dtype=np.float32)
    belt = (dist > 5) & (dist <= 20)
    best = None
    ny, nx = HH.shape[1:]
    for r in range(0, ny - B + 1, 5):
        for c in range(0, nx - B + 1, 5):
            if belt[r:r + B, c:c + B].mean() < 0.8:
                continue
            sh = vegs[:, r:r + B, c:c + B].mean(axis=(1, 2))
            if best is None or sh.max() - sh[0] > best[0]:
                best = (float(sh.max() - sh[0]), r, c, sh)
    featured = None
    if best:
        _, r, c, sh = best
        k = int(np.argmax(np.diff(sh)))
        g = m["grid"]
        tr = Transformer.from_crs(m["epsg"], 4326, always_xy=True)
        # inset by half a cell so the app's lon/lat -> cell rectangle maps back to the same cells
        xa, xb = g["x0"] + c * g["res_m"] + g["res_m"] / 2, g["x0"] + (c + B) * g["res_m"] - g["res_m"] / 2
        ya, yb = g["y1"] - (r + B) * g["res_m"] + g["res_m"] / 2, g["y1"] - r * g["res_m"] - g["res_m"] / 2
        lons, lats = tr.transform([xa, xb, xa, xb], [ya, ya, yb, yb])
        featured = {
            "name": "Flooded-forest belt example",
            "bounds": {"w": round(max(lons[0], lons[2]), 5), "e": round(min(lons[1], lons[3]), 5),
                       "s": round(max(lats[0], lats[1]), 5), "n": round(min(lats[2], lats[3]), 5)},
            "pair": f"{dates[k]}_{dates[k + 1]}",
            "flooded_veg_share": [r2(x) for x in sh],
            "why": "10 x 10 km box, at least 80% of it 5-20 km from JRC permanent water, where the share of "
                   "flooded-vegetation-like cells rose most during the season; the pair shown is the 12-day "
                   "interval with the biggest rise. Picked by the radar signal itself, as an example.",
        }

    # Threshold sweep: how detection and false alarms move with the HH water threshold.
    sweep = []
    for t in range(-24, -11):
        det, fa = [], []
        for k in range(len(obs)):
            water, _, fin = classify(HH[k], HV[k], s, hh_max=float(t))
            det.append(water[perm & fin].mean())
            fa.append(water[never & fin].mean())
        sweep.append({"hh_max_db": t, "water_found_in_permanent": r2(np.median(det)),
                      "water_flagged_on_never_water_land": r2(np.median(fa))})

    print("wind at pass times (ERA5 via Open-Meteo) ...")
    wind = wind_at_passes(clat, clon, obs)
    for d, wv in zip(per_date, wind):
        d["wind_ms"] = None if wv is None else round(float(wv), 1)
        d["windy"] = wv is not None and wv >= WINDY_MS
    det = [d["water_found_in_permanent"] for d in per_date]
    wind_corr = r2(pearson([d["wind_ms"] if d["wind_ms"] is not None else np.nan for d in per_date], det))

    print("river discharge on pass dates (GloFAS via Open-Meteo) ...")
    water_area = [d["water_km2"] for d in per_date]
    veg_area = [d["flooded_veg_km2"] for d in per_date]
    total_area = [w + v for w, v in zip(water_area, veg_area)]
    rivers = []
    for p in RIVER_POINTS.get(area, []):
        q, cell = discharge_on(p["lat"], p["lon"], dates)
        qn = [np.nan if x is None else x for x in q]
        rivers.append({**p, "glofas_cell": cell, "discharge_m3s": [None if x is None else round(x, 1) for x in q],
                       "pearson_vs_water": r2(pearson(qn, water_area)), "spearman_vs_water": r2(spearman(qn, water_area)),
                       "pearson_vs_flooded_veg": r2(pearson(qn, veg_area)), "spearman_vs_flooded_veg": r2(spearman(qn, veg_area)),
                       "pearson_vs_water_plus_veg": r2(pearson(qn, total_area)),
                       "spearman_vs_water_plus_veg": r2(spearman(qn, total_area))})

    out = {
        "area": area, "stack": stack, "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "script": "scripts/validation/validate_area.py",
        "note": "Independent checks. None of these datasets was used to make the radar products or thresholds. "
                "JRC describes 1984-2021, not 2026, and GloFAS is a model, so agreement is supporting evidence, not proof.",
        "grid_res_m": m["grid"]["res_m"],
        "jrc": {
            "dataset": "JRC Global Surface Water occurrence v1.4 (1984-2021, Landsat)", "tile": tile,
            "url": f"{JRC_BASE}/{tile}", "license": "Free, with attribution (EC JRC / Google)",
            "classes": {"permanent": "whole cell water in at least 90% of observations",
                        "never": "whole cell never observed as water",
                        "sometimes": "average occurrence 5-75% (seasonally or occasionally wet)"},
            "cells": {"permanent": int(perm.sum()), "never": int(never.sum()), "sometimes": int(sometimes.sum())},
            "threshold_sweep": {"note": "median over all dates", "current_hh_max_db": s["open_water"]["hh_max_db"]["value"],
                                "rows": sweep},
        },
        "featured": featured,
        "flooded_veg_by_distance": {
            "note": "Distance from JRC permanent water. Shares are for land JRC never saw wet; new area is from the "
                    "first pass to the flooded-vegetation peak.",
            "first": dates[0], "peak": dates[peak_k], "dates": dates, "rows": by_distance},
        "wind": {"dataset": "ERA5 10 m wind speed via Open-Meteo, nearest hour to each pass, area centre",
                 "windy_threshold_ms": WINDY_MS, "pearson_wind_vs_water_found": wind_corr},
        "rivers": {"dataset": "GloFAS v4 modelled daily river discharge (Copernicus EMS) via Open-Meteo Flood API",
                   "n_dates": len(dates), "points": rivers},
        "per_date": per_date,
    }
    dest = WEB_DATA / area / "validation.json"
    dest.write_text(json.dumps(out, indent=1))
    print(json.dumps({k: out[k] for k in ("jrc", "wind", "rivers")}, indent=1))
    for d in per_date:
        print(d)
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
