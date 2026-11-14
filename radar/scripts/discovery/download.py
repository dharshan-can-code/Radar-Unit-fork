"""Download the primary NISAR GCOV stack for a study area.

Requires a NASA Earthdata Login *token* (not your password) in the
environment variable EARTHDATA_TOKEN. Create one yourself at
https://urs.earthdata.nasa.gov -> "Generate Token". Never commit it.

Each GCOV file is ~1.8 GB. Start with --limit 2 (one pair) to test.

Run:
  set EARTHDATA_TOKEN=...            (PowerShell: $env:EARTHDATA_TOKEN="...")
  .venv/Scripts/python scripts/discovery/download.py --area tonle_sap --limit 2
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import METADATA, RAW  # noqa: E402

# The primary stack chosen in DATA_FEASIBILITY_REPORT.md: one track, one frame,
# one bandwidth mode, one processing release => directly comparable dates.
PRIMARY_STACK = {
    "tonle_sap": dict(track=83, frame=8, range_bandwidth="20+5", collection="NISAR_L2_GCOV_PROVISIONAL_V1"),
    "barataria": dict(track=105, frame=16, range_bandwidth="40+5", collection="NISAR_L2_GCOV_PROVISIONAL_V1"),
}


def select_stack(area: str) -> pd.DataFrame:
    inv = pd.read_csv(METADATA / f"inventory_{area}.csv", dtype={"range_bandwidth": str})
    sel = inv
    for k, v in PRIMARY_STACK[area].items():
        sel = sel[sel[k] == v]
    return sel.drop_duplicates("date").sort_values("date")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--area", default="tonle_sap", choices=list(PRIMARY_STACK))
    ap.add_argument("--limit", type=int, default=None, help="download only the first N dates")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    stack = select_stack(args.area)
    if args.limit:
        stack = stack.head(args.limit)
    total_gb = stack.h5_bytes.sum() / 1e9
    print(f"{len(stack)} files, {total_gb:.1f} GB:")
    for r in stack.itertuples():
        print(f"  {r.date}  {r.scene_name}")
    if args.dry_run:
        return

    token = os.environ.get("EARTHDATA_TOKEN") or ""
    token_file = Path(__file__).resolve().parents[2] / ".earthdata_token"  # git-ignored, never printed
    if not token and token_file.exists():
        token = token_file.read_text(encoding="utf-8-sig")
    token = token.strip().strip("\"'").strip()
    if not token:
        sys.exit("EARTHDATA_TOKEN is not set. See the docstring at the top of this file.")
    # Diagnostics that never reveal the token itself.
    looks_like_jwt = token.startswith("eyJ") and token.count(".") == 2
    print(f"token: {len(token)} characters, JWT-shaped: {looks_like_jwt}")
    if not looks_like_jwt:
        sys.exit("That does not look like an Earthdata user token (they start with 'eyJ' and contain two dots).\n"
                 "Copy the whole token from urs.earthdata.nasa.gov -> My Profile -> Generate Token.")

    import asf_search as asf

    try:
        session = asf.ASFSession().auth_with_token(token)
    except asf.exceptions.ASFAuthenticationError:
        sys.exit("Earthdata rejected this token (expired, revoked, or copied incompletely).\n"
                 "1) Generate a NEW token, 2) log in once at https://search.asf.alaska.edu with the same\n"
                 "   account and accept the ASF authorization, 3) set EARTHDATA_TOKEN again and retry.")
    out = RAW / args.area
    out.mkdir(parents=True, exist_ok=True)
    todo = [u for u in stack.url if not (out / Path(u).name).exists()]
    print(f"downloading {len(todo)} new files to {out}")
    asf.download_urls(urls=todo, path=str(out), session=session, processes=2)


if __name__ == "__main__":
    main()
