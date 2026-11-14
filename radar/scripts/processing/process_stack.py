"""Process a stack of NISAR GCOV files into web-ready DELTA PULSE outputs.

Steps (all documented in SCIENCE.md):
  1. Read each file's metadata; refuse to mix processing releases (CRIDs)
     or projections unless explicitly allowed.
  2. Build ONE target grid over the study area in the products' UTM CRS.
  3. Bin every observation's linear power onto that grid (mean of valid
     pixels) => all dates pixel-aligned by construction.
  4. Convert to dB, compute consecutive-pair changes, apply the
     UNCALIBRATED screening rules from screening.json.
  5. Write PNG overlays, an inspection grid (Int16 dB*100) and a
     manifest.json with full provenance to public/data/<area>/.

Run:
  .venv/Scripts/python scripts/processing/process_stack.py --area tonle_sap data/raw/tonle_sap/*.h5
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import METADATA, PROCESSED, STUDY_AREAS, WEB_DATA  # noqa: E402
from gcov_reader import open_info, read_window  # noqa: E402
import radar  # noqa: E402

SCREENING = json.loads((Path(__file__).parent / "screening.json").read_text())
STRETCH = {"HH": (-25.0, 0.0), "HV": (-32.0, -8.0)}  # fixed so dates are visually comparable
CHANGE_RANGE = 6.0  # dB, colour saturates at +/- this
INSPECT_FACTOR = 2   # inspection grid = display grid coarsened by this factor
READER_VERSION = "2"  # bump when reading/masking logic changes -> invalidates the per-scene cache


def stack_id_for(info, meta=None) -> str:
    """Stack = same track, pass, frame and processing release (CRID)."""
    if meta:
        return f"t{int(meta['track'])}{str(meta['direction'])[0]}_f{int(meta['frame'])}_{meta['crid']}"
    return f"synthetic_{info.crid}"


def load_state(area):
    p = METADATA / f"state_{area}.json"
    return json.loads(p.read_text()) if p.exists() else {}


def projected_bounds(bbox, epsg):
    tr = Transformer.from_crs(4326, epsg, always_xy=True)
    x0, y0, x1, y1 = bbox
    t = np.linspace(0, 1, 41)
    lon = np.concatenate([x0 + (x1 - x0) * t, np.full_like(t, x1), x1 - (x1 - x0) * t, np.full_like(t, x0)])
    lat = np.concatenate([np.full_like(t, y0), y0 + (y1 - y0) * t, np.full_like(t, y1), y1 - (y1 - y0) * t])
    X, Y = tr.transform(lon, lat)
    return min(X), min(Y), max(X), max(Y)


def corners_lonlat(x0, y1, res, nx, ny, epsg):
    tr = Transformer.from_crs(epsg, 4326, always_xy=True)
    xs = [x0, x0 + nx * res, x0 + nx * res, x0]
    ys = [y1, y1, y1 - ny * res, y1 - ny * res]
    lon, lat = tr.transform(xs, ys)
    return [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)]  # TL, TR, BR, BL (MapLibre order)


def _rgba_gray(db, lo, hi):
    v = np.clip(np.nan_to_num((db - lo) / (hi - lo)), 0, 1)
    g = (v * 255).astype(np.uint8)
    a = np.where(np.isfinite(db), 255, 0).astype(np.uint8)
    g[~np.isfinite(db)] = 0
    return np.dstack([g, g, g, a])


def _rgba_change(d):
    # blue (decrease) -> near-transparent (no change) -> amber (increase)
    v = np.clip(np.nan_to_num(d) / CHANGE_RANGE, -1, 1)
    neg, pos = np.clip(-v, 0, 1), np.clip(v, 0, 1)
    r = (40 * neg + 245 * pos + 20 * (1 - neg - pos)).astype(np.uint8)
    g = (140 * neg + 158 * pos + 20 * (1 - neg - pos)).astype(np.uint8)
    b = (255 * neg + 11 * pos + 20 * (1 - neg - pos)).astype(np.uint8)
    a = (np.abs(v) ** 0.8 * 235).astype(np.uint8)
    a[~np.isfinite(d)] = 0
    return np.dstack([r, g, b, a])


CLASS_COLORS = {radar.LOW_BACKSCATTER: (34, 211, 238, 200), radar.DOUBLE_BOUNCE: (245, 158, 11, 220)}


def _rgba_class(c):
    out = np.zeros(c.shape + (4,), np.uint8)
    for k, col in CLASS_COLORS.items():
        out[c == k] = col
    return out


def _save(arr, path):
    """Save compactly: grayscale+alpha as LA, colour layers as a 64-colour
    palette (visual only; the exact numbers live in grid.bin / manifest)."""
    if np.array_equal(arr[..., 0], arr[..., 1]) and np.array_equal(arr[..., 1], arr[..., 2]):
        img = Image.fromarray(np.dstack([arr[..., 0], arr[..., 3]]), "LA")
    else:
        img = Image.fromarray(arr, "RGBA").quantize(colors=64, method=Image.Quantize.FASTOCTREE)
    img.save(path, optimize=True)


def load_inventory(area):
    p = METADATA / f"inventory_{area}.csv"
    if not p.exists():
        return {}
    import pandas as pd
    inv = pd.read_csv(p)
    return {r["scene_name"]: r for r in inv.to_dict("records")}


def run(area: str, files: list[str], res: float = 100.0, allow_mixed: bool = False, out_dir: Path | None = None,
        cache_root: Path | None = None):
    infos = sorted((open_info(f) for f in files), key=lambda i: i.start_time)
    seen = {}
    for i in infos:  # no duplicate dates counted twice
        if i.date in seen:
            raise SystemExit(f"two files for {i.date}: {seen[i.date].scene} and {i.scene}; keep one")
        seen[i.date] = i
    crids = {i.crid for i in infos}
    if len(crids) > 1 and not allow_mixed:
        raise SystemExit(f"mixed processing releases {crids}; use one release or pass --allow-mixed-maturity")
    epsgs = {i.epsg for i in infos}
    if len(epsgs) != 1:
        raise SystemExit(f"observations are in different projections {epsgs}; cannot align")
    synthetic = {i.synthetic for i in infos}
    if len(synthetic) != 1:
        raise SystemExit("refusing to mix synthetic fixtures with real NISAR products")
    is_demo = synthetic.pop()
    epsg = epsgs.pop()
    inv0 = load_inventory(area)
    stack_id = stack_id_for(infos[0], inv0.get(infos[0].scene))

    bx0, by0, bx1, by1 = projected_bounds(STUDY_AREAS[area]["bbox"], epsg)
    k = INSPECT_FACTOR
    x0 = np.floor(bx0 / (res * k)) * res * k
    y1 = np.ceil(by1 / (res * k)) * res * k
    nx = int(np.ceil((bx1 - x0) / (res * k))) * k
    ny = int(np.ceil((y1 - by0) / (res * k))) * k

    out = out_dir or (WEB_DATA / area / stack_id)
    (out / "img").mkdir(parents=True, exist_ok=True)
    inv = load_inventory(area)
    min_vf = SCREENING["min_valid_fraction"]["value"]
    grid_key = hashlib.sha1(f"{READER_VERSION}|{epsg}|{x0}|{y1}|{res}|{nx}|{ny}".encode()).hexdigest()[:10]
    cache_dir = (cache_root or (PROCESSED / area)) / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    n_cached = 0
    state = load_state(area)

    obs, grids_db, inspect = [], [], []
    for i in infos:
        rec = {"id": i.date, "date": i.date, "start_time": i.start_time, "scene": i.scene,
               "crid": i.crid, "epsg": i.epsg, "channels": i.channels,
               "first_listed_utc": state.get("granules", {}).get(i.scene, {}).get("first_seen_utc"),
               "downloaded_utc": state.get("downloads", {}).get(i.scene, {}).get("downloaded_utc")}
        meta = inv.get(i.scene)
        if meta:
            rec.update(track=int(meta["track"]), frame=int(meta["frame"]), direction=meta["direction"],
                       maturity=meta["maturity"], collection=meta["collection"])
        elif i.synthetic:
            rec.update(maturity="SYNTHETIC", direction=i.identification.get("orbitPassDirection"),
                       track=i.identification.get("trackNumber"), frame=i.identification.get("frameNumber"))
        dbs, vfs = {}, {}
        for pol in ("HH", "HV"):
            if pol not in i.channels:
                continue
            # Per-scene cache: re-running never re-reads a 1.8 GB file whose grid is unchanged.
            cache = cache_dir / f"{i.scene}_{pol}_{grid_key}.npz"
            if cache.exists():
                z = np.load(cache)
                p, vf = z["power"].astype(np.float64), z["valid_frac"].astype(np.float64)
                n_cached += 1
            else:
                acc = radar.GridAccumulator(x0, y1, res, nx, ny)
                for xs, ys, block, q in read_window(i, pol, (bx0 - res, bx1 + res), (by0 - res, by1 + res)):
                    acc.add(xs, ys, block, radar.valid_power(block, i.fill_values.get(pol)) & q)
                # float32 for both fresh and cached paths -> identical results either way
                p = acc.mean().astype(np.float32).astype(np.float64)
                vf = acc.valid_fraction().astype(np.float32).astype(np.float64)
                np.savez_compressed(cache, power=p.astype(np.float32), valid_frac=vf.astype(np.float32))
            p[vf < min_vf] = np.nan
            dbs[pol], vfs[pol] = radar.to_db(p), vf
            _save(_rgba_gray(dbs[pol], *STRETCH[pol]), out / "img" / f"{i.date}_{pol}.png")
            pc, vfc = radar.block_reduce_power(p, vf, k)
            inspect.append((len(obs), pol, radar.to_db(pc), vfc))
        cls = radar.screen(dbs["HH"], dbs.get("HV"), SCREENING)
        _save(_rgba_class(cls), out / "img" / f"{i.date}_class.png")
        valid = np.isfinite(dbs["HH"])
        rec["valid_fraction"] = round(float(valid.mean()), 4)
        rec["screening_counts"] = {
            "low_backscatter": int((cls == radar.LOW_BACKSCATTER).sum()),
            "double_bounce": int((cls == radar.DOUBLE_BOUNCE).sum()),
            "valid_cells": int(valid.sum()),
        }
        rec["cell_area_km2"] = (res / 1000) ** 2
        obs.append(rec)
        grids_db.append(dbs)
        print(f"  {i.date}: channels={i.channels} valid={rec['valid_fraction']:.2%}")

    pairs = []
    for a, b, ga, gb in zip(obs, obs[1:], grids_db, grids_db[1:]):
        pid = f"{a['date']}_{b['date']}"
        dd = (date.fromisoformat(b["date"]) - date.fromisoformat(a["date"])).days
        pr = {"id": pid, "before": a["date"], "after": b["date"], "delta_days": dd,
              "nominal_repeat": dd == 12, "channels": [c for c in ("HH", "HV") if c in ga and c in gb]}
        sig = SCREENING["change"]["significant_db"]["value"]
        for pol in pr["channels"]:
            d = radar.change_db(ga[pol], gb[pol])
            _save(_rgba_change(d), out / "img" / f"d_{pid}_{pol}.png")
            fin = d[np.isfinite(d)]
            pr[f"{pol}_change"] = {"mean_db": float(fin.mean()) if fin.size else None,
                                   "frac_increase": float((fin >= sig).mean()) if fin.size else None,
                                   "frac_decrease": float((fin <= -sig).mean()) if fin.size else None}
        pairs.append(pr)

    # Inspection grid: Int16 [obs, channel(HH,HV,VALID), ny, nx]
    gny, gnx = ny // k, nx // k
    grid = np.full((len(obs), 3, gny, gnx), -32768, np.int16)
    for oi, pol, dbc, vfc in inspect:
        ci = 0 if pol == "HH" else 1
        grid[oi, ci] = np.where(np.isfinite(dbc), np.round(dbc * 100), -32768).astype(np.int16)
        if pol == "HH":
            grid[oi, 2] = np.round(vfc * 10000).astype(np.int16)
    grid.tofile(out / "grid.bin")

    manifest = {
        "area": area, "stack": stack_id, "name": STUDY_AREAS[area]["name"], "bbox": STUDY_AREAS[area]["bbox"],
        "is_demonstration": is_demo,
        "demonstration_note": ("SYNTHETIC values generated by scripts/processing/make_synthetic.py to exercise the "
                               "pipeline and interface. These are NOT NISAR measurements.") if is_demo else None,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "epsg": epsg, "display": {"res_m": res, "nx": nx, "ny": ny, "x0": x0, "y1": y1,
                                   "corners": corners_lonlat(x0, y1, res, nx, ny, epsg)},
        "grid": {"file": "grid.bin", "dtype": "int16", "scale": 0.01, "nodata": -32768,
                 "shape": [len(obs), 3, gny, gnx], "channels": ["HH_db", "HV_db", "valid_frac_x1e4"],
                 "res_m": res * k, "x0": x0, "y1": y1},
        "stretch_db": STRETCH, "change_range_db": CHANGE_RANGE,
        "screening": SCREENING,
        "observations": obs, "pairs": pairs,
        "processing": {
            "steps": ["read GCOV frequencyA diagonal terms (linear gamma-naught power)",
                      "exclude non-finite, <=0 and _FillValue samples",
                      "exclude samples with product mask 0 (partially focused) or 255 (outside swath), "
                      "or any inputDataExceptionMask bit set",
                      f"bin onto common {res:.0f} m grid in EPSG:{epsg} by mean linear power",
                      f"drop cells with valid fraction < {min_vf}",
                      "dB = 10*log10(power)", "change = dB(after) - dB(before), consecutive dates only",
                      "screening rules from screening.json (UNCALIBRATED)"],
            "script": "scripts/processing/process_stack.py",
        },
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, default=str))
    removed = prune_outputs(out, obs, pairs)
    print(f"wrote {out}  ({len(obs)} observations, {len(pairs)} pairs, demo={is_demo}, "
          f"{n_cached} channel grids from cache, {removed} stale images removed)")
    return manifest


def expected_images(obs, pairs):
    names = set()
    for o in obs:
        names |= {f"{o['date']}_{c}.png" for c in o["channels"]} | {f"{o['date']}_class.png"}
    for p in pairs:
        names |= {f"d_{p['id']}_{c}.png" for c in p["channels"]}
    return names


def prune_outputs(out: Path, obs, pairs) -> int:
    """Remove PNGs in THIS stack's img/ folder that the new manifest no longer
    references (e.g. outputs from an earlier run), so the published data never
    contains images that do not belong to the listed observations."""
    keep = expected_images(obs, pairs)
    n = 0
    for f in (out / "img").glob("*.png"):
        if f.name not in keep:
            f.unlink()
            n += 1
    return n


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--area", required=True, choices=list(STUDY_AREAS))
    ap.add_argument("files", nargs="+")
    ap.add_argument("--res", type=float, default=100.0)
    ap.add_argument("--allow-mixed-maturity", action="store_true")
    a = ap.parse_args(argv)
    files = [g for f in a.files for g in (glob.glob(f) or [f])]
    run(a.area, files, a.res, a.allow_mixed_maturity)


if __name__ == "__main__":
    main()
