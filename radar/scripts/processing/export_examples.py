"""Save finished live analyses (data/live/<id>/) as static worldwide examples.

The hosted app has no backend, so these copies let visitors open real NISAR
analyses of places beyond the case study. Nothing is recomputed: files are
copied as-is and only the manifest's location fields are changed so the app
loads them from public/data/examples/<name>/.

Run (from the radar folder), once per example:
  .venv/Scripts/python scripts/processing/export_examples.py <result_id> <name> "<blurb>" [--footprint stack.json]
Then commit public/data/examples/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import DATA, WEB_DATA  # noqa: E402

LIVE = DATA / "live"
OUT = WEB_DATA / "examples"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("result_id", help="folder name under data/live/")
    ap.add_argument("name", help="short id, e.g. manaus (lowercase letters, digits, - or _)")
    ap.add_argument("blurb", help="one-line description shown on the example button")
    ap.add_argument("--footprint", help="optional JSON file with a GeoJSON geometry of the frame footprint")
    a = ap.parse_args()

    if not a.name.replace("-", "").replace("_", "").isalnum() or a.name.lower() != a.name:
        raise SystemExit("name must be lowercase letters, digits, - or _")
    src = LIVE / a.result_id
    if not (src / "manifest.json").exists():
        raise SystemExit(f"no finished analysis at {src}")
    dest = OUT / a.name
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)

    m = json.loads((dest / "manifest.json").read_text())
    obs = m["observations"]
    m["source_result_id"] = a.result_id
    m["area"], m["stack"] = "examples", a.name
    m["example_note"] = ("Saved copy of a live analysis of real NISAR GCOV data, computed "
                         f"{m['generated_utc']} by backend/analyze.py; files are unchanged.")
    (dest / "manifest.json").write_text(json.dumps(m, indent=1))

    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"examples": []}
    footprint = json.loads(Path(a.footprint).read_text()) if a.footprint else None
    entry = {"id": a.name, "name": m["name"], "blurb": a.blurb, "center": m.get("center"),
             "n_obs": len(obs), "first": obs[0]["date"], "last": obs[-1]["date"],
             "maturity": obs[0].get("maturity", ""), "track": f"{obs[0].get('track')}{str(obs[0].get('direction', ''))[:1]}",
             "computed_utc": m["generated_utc"], "footprint": footprint}
    index["examples"] = [e for e in index["examples"] if e["id"] != a.name] + [entry]
    index_path.write_text(json.dumps(index, indent=1))
    size = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file())
    print(f"saved {a.name}: {len(obs)} passes, {size / 1e6:.1f} MB -> {dest}")


if __name__ == "__main__":
    main()
