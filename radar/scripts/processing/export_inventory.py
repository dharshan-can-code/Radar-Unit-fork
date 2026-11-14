"""Copy the REAL acquisition inventory (ASF metadata) to public/data so the
app's Observation Timeline shows actual NISAR acquisition dates, even before
any radar pixels are processed.

Run:  .venv/Scripts/python scripts/processing/export_inventory.py
"""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import METADATA, STUDY_AREAS, WEB_DATA  # noqa: E402

PRIMARY = {"tonle_sap": {"track": 83, "frame": 8, "range_bandwidth": "20+5"},
           "barataria": {"track": 105, "frame": 16, "range_bandwidth": "40+5"}}


def main():
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    summary = json.loads((METADATA / "discovery_summary.json").read_text())
    out = {"generated_utc": summary["generated_utc"], "source": summary["source"], "areas": {}}
    for key in STUDY_AREAS:
        inv = pd.read_csv(METADATA / f"inventory_{key}.csv", dtype={"range_bandwidth": str})
        inv = inv[inv.aoi_overlap_frac >= 0.25]  # granules that materially cover the AOI
        p = PRIMARY[key]
        inv["primary_stack"] = (inv.track == p["track"]) & (inv.frame == p["frame"]) & \
            (inv.range_bandwidth == p["range_bandwidth"]) & (inv.maturity == "PROVISIONAL")
        cols = ["date", "start_time", "track", "frame", "direction", "maturity", "crid", "freqA_pols",
                "range_bandwidth", "frame_coverage", "aoi_overlap_frac", "scene_name", "primary_stack"]
        feats = json.loads((METADATA / f"inventory_{key}.geojson").read_text())["features"]
        prim_scenes = set(inv.loc[inv.primary_stack, "scene_name"])
        footprint = next((f["geometry"] for f in feats if f["properties"]["scene_name"] in prim_scenes), None)
        out["areas"][key] = {"name": STUDY_AREAS[key]["name"], "bbox": STUDY_AREAS[key]["bbox"],
                             "primary": p, "primary_footprint": footprint,
                             "granules": inv[cols].to_dict("records")}
    (WEB_DATA / "inventory.json").write_text(json.dumps(out, default=str))
    print("wrote", WEB_DATA / "inventory.json")


if __name__ == "__main__":
    main()
