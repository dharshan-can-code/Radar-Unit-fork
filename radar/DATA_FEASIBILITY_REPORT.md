# DELTA PULSE: Data Feasibility Report (Phase 1)

*RADAR UNIT · NASA Space Apps 2026 · generated 2026-11-14*

## Bottom line

**The project is feasible with real NISAR data, and the recommended study area is Tonle Sap Lake, Cambodia.**

The primary stack is NISAR L2 GCOV on track 83 ascending, frame 8, in the 20+5 MHz mode:
- 10 dual-pol (HH+HV) acquisitions from 2026-06-19 to 2026-10-17.
- All from one processing release: PROVISIONAL, CRID P05023, PGE R05.02.3.
- Each granule covers 100% of the study area.
- 8 consecutive pairs are at the nominal 12-day repeat. One pair spans 24 days (2026-07-25 → 2026-08-18) because of the documented permanent data gap.

**The one blocker is access.** Every NISAR file on ASF, including the small QA sidecars and browse PNGs, requires a NASA Earthdata Login. Search metadata is public, which is how this report was produced. Until a team member creates an Earthdata account and token (see "Next steps"), **no NISAR pixel values have been read.** The app currently runs on clearly labelled **synthetic demonstration data**.

## What was verified (executed, not assumed)

| Check | How | Result |
|---|---|---|
| GCOV acquisitions over both areas | `scripts/discovery/discover.py` (ASF Search API via `asf_search` 14.1.0) | Tonle Sap: 62 granules, 22 dates. Barataria: 72 granules, 34 dates. |
| Duplicate granules | dedupe on (scene, collection) | 0 duplicates in either area |
| Processing release consistency within the stack | `crid` / `pge_version` per granule | Primary stacks use a single CRID |
| Polarisation per acquisition | `mainBandPolarization` | Some dates on Tonle Sap tracks 76/148 are **HH-only**. Track 83 is HH+HV on every date. |
| Unauthenticated file access | HTTP requests to .h5, QA CSV/H5, ISO XML, browse PNG | All redirect to Earthdata Login (302/303) |
| HDF5 inspection, processing and change maths | Run end to end on **synthetic** HDF5 fixtures | Works; 12 unit tests pass |
| HDF5 structure of a **real** GCOV file | — | **NOT VERIFIED** (needs Earthdata access) |

## Study area comparison (from ASF metadata, retrieved 2026-11-14)

| Criterion | Tonle Sap (Cambodia) | Barataria Bay (Louisiana) |
|---|---|---|
| Area box (lon/lat) | 103.55–104.55 E, 12.35–13.35 N | 90.25–89.75 W, 29.20–29.70 N |
| GCOV granules / unique dates | 62 / 22 | 72 / 34 |
| Date range | 2026-06-19 → 2026-11-03 | 2025-11-17 → 2026-11-04 |
| Tracks | 83A, 76D, 148D | 105A, 156D |
| **Best consistent stack** | **83A f8, 20+5 MHz, P05023: 10 dates, HH+HV, 100% coverage** | 105A f16, 40+5 MHz, P05023: 10 dates, HH+HV, 100% coverage |
| Second stack | 148D f82: 9 dates (5 dual-pol, 4 HH-only), 99% coverage | 156D f74: 9 PROVISIONAL dates, HH+HV |
| Maturity | PROVISIONAL (Jun–Oct) + VALIDATED (from 21 Oct) | BETA (Nov 2025–Jan 2026, pre-calibration), PROVISIONAL, VALIDATED, plus 2 granules in a `NISAR_UR_L2` collection |
| GCOV posting (from bandwidth, per ASF docs) | 20 MHz → 20 m | 40 MHz → 10 m |
| File size per granule | ~1.85 GB | ~3.6 GB (frame 16) |
| Download for the full primary stack | **~18.7 GB** | ~36 GB |
| Expected physical signal inside the data window | **Large and predictable.** The monsoon flood pulse rises through June–October, so the lake and its flooded forest expand within exactly these dates. | Subtle. Tides, storm surge and marsh degradation. Change depends on water level at acquisition time; no single seasonal pulse. |
| Independent reference data | Mekong River Commission water-level stations (e.g. Kampong Luong, Prek Kdam; access to check), JRC Global Surface Water, ESA WorldCover, GPM IMERG | **Strong:** CRMS marsh water-level stations, NOAA Grand Isle tide gauge, USFWS NWI, USGS 3DEP |

### Recommendation: Tonle Sap

The amount of data is equivalent for the two sites: 10 consistent dual-pol dates each. The deciding factors are:

1. **Signal.** The 2026 Tonle Sap flood pulse happens *inside* the observation window. That gives a strong, physically understood change for the Radar Change Fingerprint to explain. Barataria's changes in the same window are smaller and dominated by tide timing.
2. **Science fit.** Seasonally flooded forest and shrubland is the classic case where L-band double-bounce scattering matters. That is the exact "hidden water" question.
3. **Practicality.** Half the download volume.

**Barataria remains a strong second site** because its validation data is better (CRMS gauges inside the marsh). The pipeline is area-agnostic: `discover.py`, `download.py` and `process_stack.py` already accept `--area barataria`.

## Candidate observation pairs (primary stack, Tonle Sap 83A)

Full list: `data/metadata/pairs_tonle_sap.csv`.

| Before | After | Days | Note |
|---|---|---|---|
| 2026-06-19 | 2026-07-01 | 12 | early rising water |
| 2026-07-01 | 2026-07-13 | 12 | |
| 2026-07-13 | 2026-07-25 | 12 | |
| 2026-07-25 | 2026-08-18 | **24** | spans the documented permanent gap (2026-07-27 → 2026-08-10) |
| 2026-08-18 | 2026-08-30 | 12 | |
| 2026-08-30 | 2026-09-11 | 12 | |
| 2026-09-11 | 2026-09-23 | 12 | |
| 2026-09-23 | 2026-10-05 | 12 | near flood peak (typical timing; verify with gauge) |
| 2026-10-05 | 2026-10-17 | 12 | |

The 2026-10-29 acquisition on the same track is VALIDATED (P05036). It is deliberately **not** paired with the PROVISIONAL stack. VALIDATED reprocessing of the earlier dates is planned by ASF for 2027.

## What the data can and cannot support

**Can support:**
- Per-date HH and HV gamma-naught backscatter maps.
- Consecutive-pair change maps.
- Region statistics.
- Screening for low-backscatter (open-water-like) and double-bounce-like signatures.
- Time series over about 5 months.

**Cannot support yet:**
- Confirmed flood extent or accuracy numbers. This needs calibration and validation against reference data.
- Multi-year trends or attribution to dams. About 5 months of data is not enough.
- Off-diagonal polarimetric analysis. Dual-pol GCOV provides only the diagonal terms, according to the ASF GCOV page.
- InSAR water-level change. GUNW is a separate product and is out of scope for Phase 1.

## Scientific limitations

See [LIMITATIONS.md](LIMITATIONS.md).

## Next steps (in order)

1. **One team member creates a NASA Earthdata Login** at urs.earthdata.nasa.gov, then generates a **user token** (Profile → Generate Token). Keep it out of the repo.
2. Download one pair (about 3.7 GB):

   PowerShell:
   ```
   $env:EARTHDATA_TOKEN = "<token>"
   .venv\Scripts\python scripts\discovery\download.py --area tonle_sap --limit 2
   ```
3. **Inspect the real file before trusting the reader:**
   ```
   .venv\Scripts\python scripts\inspection\inspect_h5.py data\raw\tonle_sap\<file>.h5
   ```
   Confirm all of the following. If anything differs, update `DEFAULT_PATHS` in `scripts/processing/gcov_reader.py`.
   - The `HHHH`/`HVHV` paths.
   - The `projection` EPSG attribute.
   - The fill value.
   - That values are non-negative linear power.
   - Whether the product `mask` layer should be applied, and with what semantics.
4. Process the pair, check the result in the app, then download the remaining 8 dates and process all 10.
5. Calibrate `scripts/processing/screening.json` against JRC permanent water and WorldCover tree cover. Record the evidence there.
