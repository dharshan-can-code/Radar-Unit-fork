"""DELTA PULSE data refresh: check ASF for new NISAR GCOV acquisitions,
download what is missing, process every compatible stack, update the app.

  1. Query ASF (public search metadata) for GCOV over the study area.
  2. Compare with the saved state: record when each granule was FIRST
     listed, flag new ones. Nothing is ever removed from the state, so
     history is preserved.
  3. Group granules into compatible stacks: same track, pass direction,
     frame, bandwidth mode and processing release (CRID). Releases are
     never mixed.
  4. Download granules of the tracked stacks that are missing or
     incomplete (size checked against ASF metadata). Needs an Earthdata
     token (EARTHDATA_TOKEN env var or the git-ignored .earthdata_token
     file); without one, this step is skipped and reported.
  5. Process each stack with >= 2 downloaded dates. Per-scene results are
     cached, so only new files are read.
  6. Write public/data/<area>/stacks.json and public/data/status.json,
     which the app reads to show what was checked, retrieved and processed.

Run (from the radar folder):
  .venv/Scripts/python scripts/refresh.py                 # check + download + process
  .venv/Scripts/python scripts/refresh.py --no-download   # check and report only
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE / "discovery"), str(HERE / "processing")]
from config import METADATA, RAW, ROOT, STUDY_AREAS, WEB_DATA  # noqa: E402

# Which acquisitions we track (download + process) per area. Other tracks are
# listed in the inventory/timeline but not downloaded.
TRACKED = {
    "tonle_sap": {"track": 83, "frame": 8, "range_bandwidth": "20+5"},
    "barataria": {"track": 105, "frame": 16, "range_bandwidth": "40+5"},
}
# Never download/process pre-calibration (BETA) or unclassified collections.
USABLE_MATURITY = {"PROVISIONAL", "VALIDATED"}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def state_path(area):
    return METADATA / f"state_{area}.json"


def load_state(area) -> dict:
    p = state_path(area)
    if p.exists():
        return json.loads(p.read_text())
    return {"area": area, "granules": {}, "downloads": {}, "checks": []}


def save_state(area, st):
    state_path(area).write_text(json.dumps(st, indent=1, default=str))


def diff_inventory(state: dict, inv: pd.DataFrame, checked: str) -> list[str]:
    """Record first-seen time for every granule; return scene names that are new."""
    new = []
    for r in inv.to_dict("records"):
        g = state["granules"].get(r["scene_name"])
        if g is None:
            new.append(r["scene_name"])
            state["granules"][r["scene_name"]] = {
                "first_seen_utc": checked, "date": r["date"], "track": int(r["track"]), "frame": int(r["frame"]),
                "direction": r["direction"], "maturity": r["maturity"], "crid": r["crid"],
                "pols": r["freqA_pols"], "range_bandwidth": str(r["range_bandwidth"]), "h5_bytes": r["h5_bytes"],
                "url": r["url"]}
        else:
            g["last_seen_utc"] = checked
    return new


def tracked_granules(inv: pd.DataFrame, area: str) -> pd.DataFrame:
    t = TRACKED[area]
    sel = inv[(inv.track == t["track"]) & (inv.frame == t["frame"]) &
              (inv.range_bandwidth.astype(str) == t["range_bandwidth"]) & inv.maturity.isin(USABLE_MATURITY)]
    return sel.drop_duplicates("scene_name").sort_values("start_time")


def local_status(row, raw_dir: Path) -> str:
    """'complete', 'incomplete' or 'missing' (size verified against ASF metadata)."""
    f = raw_dir / Path(row["url"]).name
    if not f.exists():
        return "missing"
    exp = row.get("h5_bytes")
    if pd.notna(exp) and f.stat().st_size != int(exp):
        return "incomplete"
    return "complete"


def get_token() -> str | None:
    tok = os.environ.get("EARTHDATA_TOKEN") or ""
    tf = ROOT / ".earthdata_token"
    if not tok and tf.exists():
        tok = tf.read_text(encoding="utf-8-sig")
    tok = tok.strip().strip("\"'").strip()
    return tok if tok.startswith("eyJ") and tok.count(".") == 2 else None


def download(rows: pd.DataFrame, raw_dir: Path, token: str, state: dict):
    import asf_search as asf

    session = asf.ASFSession().auth_with_token(token)
    for r in rows.to_dict("records"):
        f = raw_dir / Path(r["url"]).name
        if f.exists():  # incomplete: keep the partial aside instead of deleting it
            f.rename(f.with_suffix(".h5.incomplete"))
        print(f"  downloading {r['date']} {f.name}")
        asf.download_url(url=r["url"], path=str(raw_dir), filename=f.name, session=session)
        ok = f.exists() and (pd.isna(r.get("h5_bytes")) or f.stat().st_size == int(r["h5_bytes"]))
        state["downloads"][r["scene_name"]] = {"downloaded_utc": now_utc(), "bytes": f.stat().st_size if f.exists() else 0,
                                               "verified_size": bool(ok)}
        save_state(state["area"], state)
        if not ok:
            print(f"  WARNING: {f.name} size does not match ASF metadata; will retry next refresh")


def process_stacks(area: str, sel: pd.DataFrame, raw_dir: Path) -> list[dict]:
    from process_stack import run

    stacks = []
    for crid, g in sel.groupby("crid"):
        files = [raw_dir / Path(u).name for u in g.url]
        have = [str(f) for f, st in zip(files, (local_status(r, raw_dir) for r in g.to_dict("records")))
                if st == "complete"]
        first = g.iloc[0]
        sid = f"t{int(first.track)}{first.direction[0]}_f{int(first.frame)}_{crid}"
        info = {"id": sid, "crid": crid, "maturity": first.maturity, "track": int(first.track),
                "direction": first.direction, "frame": int(first.frame),
                "dates_available": sorted(g.date.tolist()), "dates_downloaded": sorted(
                    d for d, f in zip(g.date, files) if str(f) in have)}
        if len(have) >= 2:
            print(f"processing stack {sid}: {len(have)} dates")
            m = run(area, have)
            info.update(processed=True, n_obs=len(m["observations"]), first=m["observations"][0]["date"],
                        last=m["observations"][-1]["date"], latest_pair=m["pairs"][-1]["id"] if m["pairs"] else None)
        else:
            info.update(processed=False, reason=f"{len(have)} downloaded date(s); a comparison needs at least 2")
        stacks.append(info)
    return stacks


def refresh(area: str, allow_download: bool = True, skip_discovery: bool = False) -> dict:
    import discover

    checked = now_utc()
    if not skip_discovery:
        discover.main(["--areas", area])
    inv = pd.read_csv(METADATA / f"inventory_{area}.csv", dtype={"range_bandwidth": str})
    state = load_state(area)
    new = diff_inventory(state, inv, checked)
    sel = tracked_granules(inv, area)
    raw_dir = RAW / area
    raw_dir.mkdir(parents=True, exist_ok=True)
    statuses = {r["scene_name"]: local_status(r, raw_dir) for r in sel.to_dict("records")}
    need = sel[[statuses[s] != "complete" for s in sel.scene_name]]

    token = get_token() if allow_download else None
    if len(need) and token:
        print(f"{len(need)} tracked granule(s) to download ({need.h5_bytes.sum() / 1e9:.1f} GB)")
        download(need, raw_dir, token, state)
        statuses = {r["scene_name"]: local_status(r, raw_dir) for r in sel.to_dict("records")}
    elif len(need):
        print(f"{len(need)} tracked granule(s) not downloaded "
              f"({'no Earthdata token found' if allow_download else '--no-download'})")

    for r in sel.to_dict("records"):  # files downloaded earlier (e.g. by download.py) get a record too
        f = raw_dir / Path(r["url"]).name
        if statuses[r["scene_name"]] == "complete" and r["scene_name"] not in state["downloads"]:
            state["downloads"][r["scene_name"]] = {
                "downloaded_utc": datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"),
                "bytes": f.stat().st_size, "verified_size": True, "note": "found on disk; time = file modification time"}
    save_state(area, state)

    stacks = process_stacks(area, sel, raw_dir)
    processed = [s for s in stacks if s.get("processed")]
    # Default stack = the one whose latest comparison is most recent.
    default = max(processed, key=lambda s: s["last"])["id"] if processed else None
    (WEB_DATA / area).mkdir(parents=True, exist_ok=True)
    (WEB_DATA / area / "stacks.json").write_text(json.dumps({"area": area, "default": default, "stacks": stacks}, indent=1))

    check = {"checked_utc": checked, "n_granules_listed": int(len(inv)), "new_scenes": new,
             "tracked_missing": [s for s, st in statuses.items() if st != "complete"],
             "token_available": bool(token), "processed_stacks": [s["id"] for s in processed]}
    state["checks"].append(check)
    save_state(area, state)

    latest_listed = inv.sort_values("start_time").iloc[-1] if len(inv) else None
    status = {
        "area": area, "name": STUDY_AREAS[area]["name"], "checked_utc": checked,
        "source": "ASF Search API (asf_search), dataset NISAR, processingLevel GCOV",
        "latest_listed_acquisition": latest_listed["date"] if latest_listed is not None else None,
        "new_since_previous_check": len(new) if len(state["checks"]) > 1 else None,
        "tracked": TRACKED[area],
        "tracked_available": int(len(sel)),
        "tracked_downloaded": int(sum(st == "complete" for st in statuses.values())),
        "tracked_not_downloaded": [{"date": state["granules"][s]["date"], "maturity": state["granules"][s]["maturity"],
                                    "crid": state["granules"][s]["crid"]} for s, st in statuses.items() if st != "complete"],
        "stacks": stacks, "default_stack": default,
    }
    all_status_p = WEB_DATA / "status.json"
    all_status = json.loads(all_status_p.read_text()) if all_status_p.exists() else {}
    all_status[area] = status
    all_status_p.write_text(json.dumps(all_status, indent=1, default=str))

    import export_inventory
    export_inventory.main()
    print(f"refresh done: {len(new)} new granule(s) listed; {status['tracked_downloaded']}/{status['tracked_available']} "
          f"tracked downloaded; stacks processed: {check['processed_stacks'] or 'none'}")
    return status


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--area", default="tonle_sap", choices=list(TRACKED))
    ap.add_argument("--no-download", action="store_true")
    ap.add_argument("--skip-discovery", action="store_true", help="reuse the last inventory (offline)")
    a = ap.parse_args(argv)
    refresh(a.area, allow_download=not a.no_download, skip_discovery=a.skip_discovery)


if __name__ == "__main__":
    main()
