# Limitations (what DELTA PULSE cannot conclude)

1. **One season, one release in the case study.** The Tonle Sap case study uses all 10 PROVISIONAL (P05023) acquisitions from 2026-06-19 to 2026-10-17. Newer VALIDATED (P05036) acquisitions are listed separately and are not mixed in. `scripts/refresh.py` adds new acquisitions as they appear.
2. **Reader verified on two file layouts.** Dataset paths, EPSG, NaN fill values and mask semantics were checked on real P05023 (product 1.0.11) and P05036 (product 1.0.20) GCOV files. Re-run `inspect_h5.py` when a new product version first appears.
3. **Product maturity.** Data before 2026-10-21 is PROVISIONAL: calibrated and partially validated. It will be superseded by VALIDATED reprocessing in 2027. Releases are never mixed in one quantitative analysis.
4. **Short record.** About 5 months, one season. No trends, no inter-annual comparison, no attribution to dams or land use.
5. **Irregular sampling.** One 24-day interval caused by a documented permanent data gap. Nothing is interpolated.
6. **Screening thresholds are uncalibrated.** They are starting values from general L-band behaviour, not validated detection thresholds. Areas in the app (e.g. "water-like area grew 62%") are areas of a *screening class*, useful for direction and timing of change. They are not calibrated flood-extent or accuracy figures. The sensitivity test shows the direction of change and the peak dates hold when the threshold moves ±2 dB.
7. **Ambiguity of backscatter.** Double bounce also comes from buildings. Low backscatter also comes from smooth soil and radar shadow. Wind can brighten water. Moisture and crop growth change backscatter too.
8. **No independent validation yet.** Optical images (NASA GIBS), rainfall and cloud cover (ERA5) and modelled river discharge (GloFAS) are shown as *context*, but no gauge, field or calibrated reference data is used, so nothing is labelled as confirmed flooding.
9. **Resolution.** Layers are 100 m and the fingerprint grid is 200 m (averaged to reduce speckle). Features smaller than that are not resolved.
10. **Map geometry.** UTM rasters are drawn as 4-corner web-map overlays. That can shift positions by less than one cell near the edges.
11. **Not real time.** NISAR revisits every 12 days and products are archived after processing. The app shows the acquisition date of every image and when the archive was last checked.
12. **Single geometry.** Only ascending track 83 is used, so incidence angle and look direction are fixed. Other tracks are not mixed.
13. **Cloud cover is a point value.** Cloud cover at each pass comes from ERA5 at the centre of the area, not from the whole window. Many NISAR passes also happen near dawn or dusk, when optical satellites cannot image at all.
