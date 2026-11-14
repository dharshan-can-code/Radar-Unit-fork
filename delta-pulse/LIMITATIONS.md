# Limitations (what DELTA PULSE cannot conclude)

1. **No real NISAR pixels have been processed yet.** The app runs on synthetic demonstration data, flagged in `manifest.json` (`is_demonstration: true`) and by a permanent banner.
2. **The GCOV reader is unverified against a real file.** Dataset paths, the EPSG attribute, fill values and mask semantics follow ASF documentation. They must be confirmed with `inspect_h5.py`.
3. **Product maturity.** Data before 2026-10-21 is PROVISIONAL: calibrated and partially validated. It will be superseded by VALIDATED reprocessing in 2027. Releases are never mixed in one quantitative analysis.
4. **Short record.** About 5 months, one season. No trends, no inter-annual comparison, no attribution to dams or land use.
5. **Irregular sampling.** One 24-day interval caused by a documented permanent data gap. Nothing is interpolated.
6. **Screening thresholds are uncalibrated.** They are starting values from general L-band behaviour, not validated detection thresholds. No accuracy or area numbers should be quoted until they are calibrated.
7. **Ambiguity of backscatter.** Double bounce also comes from buildings. Low backscatter also comes from smooth soil and radar shadow. Wind can brighten water. Moisture and crop growth change backscatter too.
8. **No independent validation integrated yet.** No gauge, optical or field data is in the app, so nothing is labelled as confirmed flooding.
9. **Resolution.** Layers are 100 m and the fingerprint grid is 200 m (averaged to reduce speckle). Features smaller than that are not resolved.
10. **Map geometry.** UTM rasters are drawn as 4-corner web-map overlays. That can shift positions by less than one cell near the edges.
11. **Single geometry.** Only ascending track 83 is used, so incidence angle and look direction are fixed. Other tracks are not mixed.
