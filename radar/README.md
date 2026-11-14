# DELTA PULSE: Hidden Water

**RADAR UNIT · NASA Space Apps Challenge 2026 · "Dancing with the SARs"**

DELTA PULSE is an interactive web app that uses NASA-ISRO **NISAR L-band radar** (L2 GCOV) to explore wetland change at **Tonle Sap Lake, Cambodia**. It shows four things:
- what the radar measured
- what changed between two acquisitions
- which explanations are consistent with that change, such as possible flooding beneath vegetation
- what evidence is still missing

Every statement in the app is tagged **OBSERVED**, **CALCULATED**, **INTERPRETED** or **UNCONFIRMED**.

> **All map layers, statistics and dates come from real NISAR L2 GCOV products** retrieved from the ASF DAAC. No simulated data is shown in the app. (Synthetic HDF5 files are generated only inside the automated tests.) The header shows when the ASF archive was last checked, which acquisitions are processed, and which are available but not yet retrieved.

**Judges / submitters: see [SUBMISSION.md](SUBMISSION.md).** **New here? Read the [User Manual](USER_MANUAL.md)**, or click **How to use** in the app.

## Features
1. **Hidden Water Explorer:** before/after swipe, a measured-change layer, a screening layer, an optical context basemap, and click-or-draw region selection.
2. **Radar Change Fingerprint:** before/after/Δ for HH and HV, a per-cell change histogram, screening shares, data quality, an evidence-tagged interpretation, and a region time series.
3. **Observation Timeline:** every real NISAR GCOV granule over both candidate sites, by track, maturity and polarisation, with the documented data gap marked.
4. **Science explainer** and **Methods & limitations**, including the uncalibrated screening thresholds.
5. **Explore anywhere:** type a place or coordinates, click the map, or pick from the live **Newest NISAR acquisitions worldwide** map. The backend searches NASA's archive live and analyses a 10–40 km window in about 10–15 s, reading only the needed chunks of the real files.
6. **Your Story:** type any place and get an animated, data-driven story of the water hidden there (cloud cover at each pass, radar flipbook, hidden-water timeline, biggest change, evidence labels).
7. **Impact** section and a **sensitivity test** showing the conclusions hold when the threshold moves ±2 dB.
8. **Rainfall context** (ERA5 via Open-Meteo), **CSV / image / JSON downloads**, **share links**, a **recent analyses** gallery and an **opacity** slider.

## Run the app
```bash
npm install
npm run dev        # http://localhost:3000
```

## Backend: search anywhere on Earth
`npm.cmd run api` starts the FastAPI server on http://localhost:8000. Type a place, list the NISAR acquisitions over it live from ASF, and analyse a 2–40 km window read remotely, with no full downloads. See [BACKEND.md](BACKEND.md).

## Refresh the data (one command)
Needs an Earthdata token, either in `$env:EARTHDATA_TOKEN` or in the git-ignored file `.earthdata_token` (see DATA_FEASIBILITY_REPORT.md).
```powershell
.\.venv\Scripts\python.exe scripts\refresh.py                 # check ASF, download missing/incomplete, process, update app
.\.venv\Scripts\python.exe scripts\refresh.py --no-download   # check and report only
npm run refresh      # same as the first line
```
What it does:
1. Queries ASF for every GCOV granule over the area and records the time each was first listed. History is kept in `data/metadata/state_<area>.json`.
2. Downloads only the tracked track/frame granules that are missing or have the wrong size.
3. Processes each release separately. Per-scene results are cached, so old files are never re-read.
4. Rewrites `public/data/status.json` and `public/data/<area>/stacks.json`. Reload the page to see the result.

The refresh only runs when you run it, or when you schedule it yourself (e.g. Windows Task Scheduler). Nothing in the web app polls ASF.

## Run the data pipeline step by step (Python 3.11+)
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows path; use .venv/bin on macOS/Linux

# 1. Discover acquisitions (public metadata, no login)
.venv/Scripts/python scripts/discovery/discover.py
.venv/Scripts/python scripts/processing/export_inventory.py

# 2. Download (needs EARTHDATA_TOKEN env var, see the report)
.venv/Scripts/python scripts/discovery/download.py --area tonle_sap --limit 2

# 3. Inspect a real file BEFORE processing
.venv/Scripts/python scripts/inspection/inspect_h5.py data/raw/tonle_sap/<file>.h5

# 4. Process into web outputs (replaces the demo data in public/data/tonle_sap)
.venv/Scripts/python scripts/processing/process_stack.py --area tonle_sap "data/raw/tonle_sap/*.h5"

# Tests
.venv/Scripts/python -m pytest -q
```

## Repository map
| Path | What |
|---|---|
| `app/`, `components/`, `lib/data.ts` | Next.js + TypeScript + Tailwind + MapLibre + Recharts front end. `lib/data.ts` holds the fingerprint maths and the interpretation rules. |
| `scripts/discovery/` | ASF search (`discover.py`) and download (`download.py`) |
| `scripts/inspection/inspect_h5.py` | Dumps HDF5 structure and value checks |
| `scripts/refresh.py` | Check, diff, download, process, publish workflow |
| `scripts/processing/` | Reader, radar maths, screening config, stack processing; `make_synthetic.py` is used by tests only |
| `data/metadata/` | Real acquisition inventories (CSV/GeoJSON), candidate pairs, discovery summary |
| `public/data/` | Files the app reads: `status.json`, `inventory.json`, `tonle_sap/stacks.json`, `tonle_sap/<stack>/` (manifest, grid, images) |
| `tests/` | pytest suite for the pipeline |

## Docs
[DATA_FEASIBILITY_REPORT.md](DATA_FEASIBILITY_REPORT.md) · [SCIENCE.md](SCIENCE.md) · [DATA_SOURCES.md](DATA_SOURCES.md) · [LIMITATIONS.md](LIMITATIONS.md) · [PROJECT_PLAN.md](PROJECT_PLAN.md)

DELTA PULSE is a student project and is not an official NASA product.
