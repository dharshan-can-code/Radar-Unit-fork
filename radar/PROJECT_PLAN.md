# Project plan (based on what the data actually supports)

## Done
- [x] Phase 1: data feasibility. Discovery, inventories, pairs, report. Recommendation: Tonle Sap.
- [x] Pipeline: download, HDF5 inspection, aligned binning, dB, change, screening, web export.
- [x] 12 unit tests, including end-to-end on synthetic HDF5.
- [x] App: Explorer, Fingerprint, Timeline (real metadata), Science, Methods.
- [x] Real NISAR GCOV verified (structure, mask semantics) and processed (2026-06-19, 2026-07-01).
- [x] Refresh workflow: discovery diff, size-verified downloads, per-release stacks, per-scene cache, status in the app.

## Next, in priority order
1. **Run `scripts/refresh.py` with a token** to retrieve and process the remaining 8 PROVISIONAL dates (~15 GB).
3. **Calibrate screening** against JRC permanent water and WorldCover. Record values and evidence in `screening.json`.
4. **Add one validation source.** MRC lake level at the acquisition dates, shown alongside the region time series and kept visually separate.
5. **Built-up mask** from WorldCover, to remove double-bounce look-alikes.
6. **Demo polish.** Default region on a known flooded-forest belt, 30-second video, project page.
7. *(Stretch)* Barataria as a second site, with CRMS gauges, using the same pipeline and `--area barataria`.

## Suggested team split
| Person | Owns |
|---|---|
| Data | Steps 1–2, `scripts/discovery`, `scripts/processing` |
| Science | Steps 3–5, `SCIENCE.md`, `LIMITATIONS.md`, interpretation rules in `lib/data.ts` |
| Front end | `components/`, map/fingerprint UX, mobile layout |
| Story / demo | Hero copy, video, slides, Space Apps submission page |

## Rules we keep
No fabricated data. Demo data is always labelled. Releases are never mixed. Measurements are kept separate from interpretation. "Flooded" is never claimed without independent evidence.
