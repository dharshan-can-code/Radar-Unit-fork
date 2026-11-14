# DELTA PULSE: Hidden Water

**RADAR UNIT · NASA Space Apps Challenge 2026 · "Dancing with the SARs"**

DELTA PULSE is an interactive web app that uses NASA-ISRO **NISAR L-band radar** (L2 GCOV) to explore wetland change at **Tonle Sap Lake, Cambodia**. It shows four things:
- what the radar measured
- what changed between two acquisitions
- which explanations are consistent with that change, such as possible flooding beneath vegetation
- what evidence is still missing

Every statement in the app is tagged **OBSERVED**, **CALCULATED**, **INTERPRETED** or **UNCONFIRMED**.

> **Current status:** the map layers and fingerprint numbers come from **synthetic demonstration data**. The app shows a banner saying so. The observation timeline is **real** ASF metadata. Real NISAR pixels need a NASA Earthdata Login; see [DATA_FEASIBILITY_REPORT.md](DATA_FEASIBILITY_REPORT.md).

## Features
1. **Hidden Water Explorer:** before/after swipe, a measured-change layer, a screening layer, an optical context basemap, and click-or-draw region selection.
2. **Radar Change Fingerprint:** before/after/Δ for HH and HV, a per-cell change histogram, screening shares, data quality, an evidence-tagged interpretation, and a region time series.
3. **Observation Timeline:** every real NISAR GCOV granule over both candidate sites, by track, maturity and polarisation, with the documented data gap marked.
4. **Science explainer** and **Methods & limitations**, including the uncalibrated screening thresholds.

## Run the app
```bash
npm install
npm run dev        # http://localhost:3000
```

## Run the data pipeline (Python 3.11+)
```bash
python -m venv .venv
.venv/Scripts/python -m pip install asf_search h5py numpy pandas shapely pyproj pillow pytest   # Windows path; use .venv/bin on macOS/Linux

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
To regenerate the demo data, run `scripts/processing/make_synthetic.py`, then `process_stack.py` on `data/raw/synthetic/*.h5`.

## Repository map
| Path | What |
|---|---|
| `app/`, `components/`, `lib/data.ts` | Next.js + TypeScript + Tailwind + MapLibre + Recharts front end. `lib/data.ts` holds the fingerprint maths and the interpretation rules. |
| `scripts/discovery/` | ASF search (`discover.py`) and download (`download.py`) |
| `scripts/inspection/inspect_h5.py` | Dumps HDF5 structure and value checks |
| `scripts/processing/` | Reader, radar maths, screening config, stack processing, synthetic fixtures |
| `data/metadata/` | Real acquisition inventories (CSV/GeoJSON), candidate pairs, discovery summary |
| `public/data/` | Files the app reads: `inventory.json` (real), `tonle_sap/` (processed; currently demo) |
| `tests/` | pytest suite for the pipeline |

## Docs
[DATA_FEASIBILITY_REPORT.md](DATA_FEASIBILITY_REPORT.md) · [SCIENCE.md](SCIENCE.md) · [DATA_SOURCES.md](DATA_SOURCES.md) · [LIMITATIONS.md](LIMITATIONS.md) · [PROJECT_PLAN.md](PROJECT_PLAN.md)

DELTA PULSE is a student project and is not an official NASA product.
