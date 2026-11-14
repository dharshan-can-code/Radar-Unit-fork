# Project plan (based on what the data actually supports)

## Done
- [x] Phase 1: data feasibility. Discovery, inventories, pairs, report. Recommendation: Tonle Sap.
- [x] Pipeline: download, HDF5 inspection, aligned binning, dB, change, screening, web export.
- [x] 28 automated tests (pipeline and backend), including end-to-end on synthetic HDF5.
- [x] App: Explorer, Fingerprint, Timeline (real metadata), Science, Methods.
- [x] Real NISAR GCOV verified (structure, mask semantics, two file layouts) and the full Tonle Sap season processed (10 dates, 2026-06-19 → 2026-10-17).
- [x] Live backend: search anywhere, remote chunk reading, Your Story, globe, weather/river context.
- [x] Refresh workflow: discovery diff, size-verified downloads, per-release stacks, per-scene cache, status in the app.

## Next, in priority order
1. **Host a demo.** Deploy the static front end; optionally host the backend with `DELTA_PULSE_ORIGINS` set (see BACKEND.md).
2. **Calibrate screening** against JRC permanent water and WorldCover. Record values and evidence in `screening.json`.
3. **Add one validation source.** MRC lake level at the acquisition dates, shown alongside the region time series and kept visually separate.
4. **Built-up mask** from WorldCover, to remove double-bounce look-alikes.
5. **Demo polish.** Default region on a known flooded-forest belt, 30-second video, project page.
6. *(Stretch)* Barataria as a second site, with CRMS gauges, using the same pipeline and `--area barataria`.

## Suggested team split
| Person | Owns |
|---|---|
| Data | Steps 1–2, `scripts/discovery`, `scripts/processing` |
| Science | Steps 3–5, `SCIENCE.md`, `LIMITATIONS.md`, interpretation rules in `lib/data.ts` |
| Front end | `components/`, map/fingerprint UX, mobile layout |
| Story / demo | Hero copy, video, slides, Space Apps submission page |

## Rules we keep
No fabricated data. Demo data is always labelled. Releases are never mixed. Measurements are kept separate from interpretation. "Flooded" is never claimed without independent evidence.
