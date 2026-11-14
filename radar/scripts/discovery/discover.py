"""Discover NISAR L2 GCOV acquisitions over the DELTA PULSE study areas.

Uses only the public ASF Search API (no login needed). Writes:
  data/metadata/inventory_<area>.csv      one row per unique granule
  data/metadata/inventory_<area>.geojson  granule footprints
  data/metadata/pairs_<area>.csv          candidate compatible observation pairs
  data/metadata/discovery_summary.json    per-area comparison numbers

Run:  .venv/Scripts/python scripts/discovery/discover.py
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from shapely.geometry import box, shape

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import COLLECTION_MATURITY, METADATA, STUDY_AREAS, bbox_wkt  # noqa: E402


def search(bbox):
    import asf_search as asf

    return asf.search(
        dataset="NISAR",
        processingLevel="GCOV",
        intersectsWith=bbox_wkt(bbox),
        maxResults=5000,
    )


def granule_row(props: dict, geom: dict, aoi) -> dict:
    fp = shape(geom)
    inter = fp.intersection(aoi).area
    coll = props.get("collectionName", "")
    files = props.get("bytes") or {}
    h5 = files.get(props.get("fileName", ""), {}).get("bytes")
    return {
        "scene_name": props["sceneName"],
        "date": props["startTime"][:10],
        "start_time": props["startTime"],
        "track": props.get("pathNumber"),
        "frame": props.get("frameNumber"),
        "direction": props.get("flightDirection"),
        "collection": coll,
        "maturity": COLLECTION_MATURITY.get(coll, "OTHER"),
        "crid": props.get("crid"),
        "pge_version": props.get("pgeVersion"),
        "processing_date": props.get("processingDate"),
        "freqA_pols": "+".join(props.get("mainBandPolarization") or []),
        "freqB_pols": "+".join(props.get("sideBandPolarization") or []),
        "range_bandwidth": "+".join(props.get("rangeBandwidth") or []),
        "frame_coverage": props.get("frameCoverage"),
        "joint_observation": props.get("jointObservation"),
        "h5_bytes": h5,
        "aoi_overlap_frac": round(inter / aoi.area, 4),
        "url": props.get("url"),
    }


def dedupe(df: pd.DataFrame) -> pd.DataFrame:
    """One row per scene. If ASF lists the same scene in two collections
    (e.g. a reprocessing), keep both but never count the same scene twice."""
    before = len(df)
    df = df.drop_duplicates(subset=["scene_name", "collection"]).copy()
    df.attrs["duplicates_removed"] = before - len(df)
    return df


def compatible_pairs(df: pd.DataFrame) -> pd.DataFrame:
    """Consecutive acquisitions that can be compared quantitatively:
    same track, frame, pass direction, collection (=> same maturity and
    processing baseline), polarisation set and bandwidth mode."""
    keys = ["track", "frame", "direction", "collection", "freqA_pols", "range_bandwidth"]
    rows = []
    for k, g in df.sort_values("start_time").groupby(keys):
        g = g.drop_duplicates("date")
        recs = g.to_dict("records")
        for a, b in zip(recs, recs[1:]):
            d = (datetime.fromisoformat(b["date"]) - datetime.fromisoformat(a["date"])).days
            rows.append({
                **dict(zip(keys, k)),
                "maturity": a["maturity"],
                "date_before": a["date"],
                "date_after": b["date"],
                "delta_days": d,
                "nominal_repeat": d == 12,
                "scene_before": a["scene_name"],
                "scene_after": b["scene_name"],
                "min_aoi_overlap": min(a["aoi_overlap_frac"], b["aoi_overlap_frac"]),
            })
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame, pairs: pd.DataFrame) -> dict:
    dual = df[df.freqA_pols.str.contains("HV")]
    stacks = (
        df.groupby(["track", "direction", "collection", "freqA_pols"])
        .agg(n_dates=("date", "nunique"), first=("date", "min"), last=("date", "max"),
             max_overlap=("aoi_overlap_frac", "max"))
        .reset_index()
        .sort_values("n_dates", ascending=False)
    )
    return {
        "n_granules": int(len(df)),
        "duplicates_removed": int(df.attrs.get("duplicates_removed", 0)),
        "n_unique_dates": int(df.date.nunique()),
        "date_range": [df.date.min(), df.date.max()] if len(df) else None,
        "tracks": sorted({f"{t}{d[0]}" for t, d in zip(df.track, df.direction)}),
        "by_maturity": df.groupby("maturity").date.nunique().to_dict(),
        "n_dual_pol_granules": int(len(dual)),
        "n_pairs": int(len(pairs)),
        "n_nominal_12day_pairs": int(pairs.nominal_repeat.sum()) if len(pairs) else 0,
        "stacks": stacks.to_dict("records"),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--areas", nargs="*", default=list(STUDY_AREAS))
    args = ap.parse_args(argv)
    METADATA.mkdir(parents=True, exist_ok=True)
    summary = {"generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "source": "ASF Search API via asf_search, dataset=NISAR, processingLevel=GCOV",
               "areas": {}}
    for key in args.areas:
        area = STUDY_AREAS[key]
        aoi = box(*area["bbox"])
        results = search(area["bbox"])
        rows = [granule_row(r.properties, r.geometry, aoi) for r in results]
        df = dedupe(pd.DataFrame(rows))
        df = df.sort_values(["start_time", "track", "frame"])
        df.to_csv(METADATA / f"inventory_{key}.csv", index=False)
        feats = [{"type": "Feature", "geometry": r.geometry,
                  "properties": {"scene_name": r.properties["sceneName"],
                                 "date": r.properties["startTime"][:10],
                                 "track": r.properties.get("pathNumber"),
                                 "direction": r.properties.get("flightDirection"),
                                 "maturity": COLLECTION_MATURITY.get(r.properties.get("collectionName"), "OTHER")}}
                 for r in results]
        (METADATA / f"inventory_{key}.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
        pairs = compatible_pairs(df)
        pairs.to_csv(METADATA / f"pairs_{key}.csv", index=False)
        summary["areas"][key] = {"name": area["name"], "bbox": area["bbox"], **summarize(df, pairs)}
        print(f"{key}: {len(df)} granules, {df.date.nunique()} dates, {len(pairs)} pairs")
    (METADATA / "discovery_summary.json").write_text(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
