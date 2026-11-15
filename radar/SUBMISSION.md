# DELTA PULSE: Space Apps 2026 submission kit

*Team RADAR UNIT · Challenge: "Dancing with the SARs" · deadline Sunday 15 Nov 2026, 11:59 pm local time*

Copy the sections below into the Project Submission page. Every number quoted comes from the app's real outputs.

---

## Project name
**DELTA PULSE: Revealing the Water We Cannot See**

## High-level summary (≈150 words)
When rivers and lakes flood into forests, the water spreads under the trees, where cameras cannot see it even on a clear day. NASA-ISRO **NISAR**'s long-wavelength L-band radar sees through the canopy: water under trunks bounces the signal back brightly. It also sees through cloud and darkness. DELTA PULSE makes NISAR usable by anyone.

- **Any place, live:** type a place on Earth. The app searches NASA's ASF archive live, reads only the needed parts of the real NISAR GCOV files (no 1.9 GB downloads), and in about 10–15 seconds shows what changed: maps, a "Radar Change Fingerprint", a time series, and rainfall and cloud context.
- **Your Story:** turns any place into an animated story about the water hidden there.
- **Honest by design:** every statement is labelled *observed*, *calculated*, *interpreted* or *unconfirmed*, so the app never claims a flood it cannot prove.

In our Tonle Sap case study, the radar signature of water under vegetation grew about 6.6× (260 → 1,704 km², peak 11 Sep) and water-like ground grew 48%, while clouds covered more than half the sky at 9 of 10 pass times. Independent checks back it up: the water class finds most of Landsat's permanent water with almost no false alarms on dry land, and the flooded area tracks river flow.

## Links
- **Live app:** https://delta-pulse-nisar.vercel.app (case study, Your Story and three worldwide examples work without a server; live search of new places needs the Python backend)
- **Code:** https://github.com/haricharanparna/Radar-Unit
- **Demo:** *(30-second video link)*
- **Guide for users:** `/guide` in the app

---

## How we addressed each judging criterion

### Impact
- **The problem:** water hidden under forest canopy and cloud is hard to track, yet seasonal flood pulses drive fisheries, farming, drinking water and wetland health. NISAR revisits every 12 days, so DELTA PULSE is built for tracking seasonal and long-term change rather than hour-by-hour emergencies.
- **Reach:** works for **any** location NISAR images, which is nearly all land every 12 days. The app's live feed shows hundreds of new products every few days.
- **Who it helps:** first, wetland and fisheries managers tracking the flood pulse (at Tonle Sap the flooded forest is where fish breed); also water agencies, farmers and recovery planners, plus students and the public through Your Story. See the in-app **Impact** section.
- **Case study:** Tonle Sap, Southeast Asia's largest freshwater lake and a UNESCO Biosphere Reserve, whose flood pulse drives one of the world's most productive inland fisheries.
- **Future:** river-gauge calibration, alerts for watched places (the scheduler already re-checks every 6 h), more languages.

### Creativity
- **"Your Story":** an automatically written, animated, data-driven story for any place. It includes cloud cover *at the exact hour the satellite passed*, a radar flipbook, the hidden-water timeline, the moment of biggest change, and an honesty chapter.
- **Remote chunk reading:** the HDF5 chunk index plus parallel HTTP range requests read a 20 km window of a 1.9 GB file in seconds.
- **The evidence-label system**, applied to every sentence.
- **A live 3D globe** of NISAR's newest acquisitions, clickable to explore.
- **Sound:** story narration, rain that follows the real rainfall, and data sonification ("hear the water": one note per pass).
- **Interactive models:** Radar Lab (a teaching model of scattering and wavelength) and Scatter Lab (drag thresholds on real pixels; the map updates live).
- **Camera vs radar, same day:** NASA GIBS MODIS/VIIRS photos beside NISAR radar from the same date, showing what the clouds hid.

### Validity
- **Real physics:** specular water (dark), volume scattering (HV), double bounce from water under trunks (bright HH, large HH−HV). Explained in plain language in the app.
- **Quality masks:** NASA's own masks are applied. We verified two different file layouts on real data, including validity bits we discovered in VALIDATED products.
- **Fair comparisons:** releases and product lines are never mixed. Story and impact numbers count only ground seen on **every** pass.
- **Independent checks** (in-app, *Methods*; script `scripts/validation/validate_area.py`), using data never used to build the screening:
  - **JRC Global Surface Water** (Landsat, 1984–2021): the water-like class finds a median 82% of permanent water and flags at most 0.1% of never-wet land.
  - **Where the hidden water appears:** the flooded-vegetation signature grows most within 20 km of the lake (4% → 22–24% of never-wet land 5–20 km out), much less far away (4% → 12% beyond 40 km).
  - **River flow (GloFAS):** the radar's flooded area tracks the Tonle Sap River, r = 0.81 over 10 dates (labelled honestly: small sample, shared seasonality).
  - **Wind (ERA5):** light at every pass (0.5–4.2 m/s); two dips in lake detection stay labelled as unexplained.
- **Sensitivity test:** the conclusions hold when the water threshold moves ±2 dB, for both the direction of change and the peak date.
- **Testing:** 32 automated tests, plus live end-to-end runs (Tonle Sap, Manaus, Sundarbans, Jakarta, Dhaka, Aleutians).
- **Usability:** navbar, in-app guide, User Guide page, share links, CSV/JSON downloads, works on phones, reduced-motion support.

### Relevance
- **Challenge requirements met:** an interactive application using NISAR data to track surface change at locations worldwide.
- **NISAR is the core,** not decoration: L2 GCOV HH/HV gamma-naught, PROVISIONAL, VALIDATED and urgent-response products, searched and read live from NASA's ASF DAAC.
- **Every image is traceable:** each one shows its acquisition date, track, frame, release (CRID) and when the archive was checked.
- **More NASA data:** GIBS / Worldview (MODIS Terra and Aqua, VIIRS) same-day imagery, used to show what optical sensors missed.

### Presentation
- The **Your Story** mode is the presentation: a judge can type their own hometown and watch its story build.
- A 30-second video (below), a navbar walk-through, and a plain-language guide.

---

## Use of NASA data (paste into "NASA Data" field)
- **NASA-ISRO NISAR Level-2 GCOV** (Geocoded Polarimetric Covariance), L-band, from the NASA Alaska Satellite Facility DAAC:
  - Collections: `NISAR_L2_GCOV_PROVISIONAL_V1` (CRID P05023), `NISAR_L2_GCOV_V1` (VALIDATED, P05036), `NISAR_UR_L2` (urgent response).
  - Discovery: ASF Search API via `asf_search`.
  - Access: HTTPS range requests to the archive with NASA Earthdata Login.
- **Case study:** Tonle Sap, track 83 ascending, frame 8. 10 acquisitions, 19 Jun – 17 Oct 2026.
- **Documentation used:** ASF NISAR Data User Guide (product specs, maturity levels, data gaps, masks).

## References (paste into "References" field)
**Data**
- NASA-ISRO NISAR L2 GCOV, NASA ASF DAAC: https://search.asf.alaska.edu, https://nisar-docs.asf.alaska.edu
- ERA5 / ERA5T reanalysis (ECMWF), precipitation and cloud cover, via the Open-Meteo Historical Weather API (CC BY 4.0)
- Current conditions: Open-Meteo forecast API (CC BY 4.0)
- River discharge: GloFAS v4, Copernicus Emergency Management Service, via the Open-Meteo Flood API (CC BY 4.0)
- JRC Global Surface Water v1.4 (EC Joint Research Centre / Google): Pekel, J.-F., Cottam, A., Gorelick, N. & Belward, A. S. (2016). High-resolution mapping of global surface water and its long-term changes. *Nature* 540, 418–422.
- NASA GIBS / Worldview: MODIS Terra and Aqua, VIIRS SNPP corrected reflectance true colour
- AWS Terrain Tiles (Mapzen; SRTM, USGS and others)
- OpenStreetMap Nominatim geocoding (© OpenStreetMap contributors, ODbL)
- Esri World Dark Gray Base and World Imagery basemaps (© Esri and data providers)

**Software (open source)**
- Python: asf_search, h5py, NumPy, pandas, pyproj, Shapely, Pillow, FastAPI, Uvicorn, requests, pytest
- JavaScript: Next.js, React, TypeScript, Tailwind CSS, MapLibre GL JS, Recharts, lucide-react, proj4js

**Tools**
- Code was written with the help of an AI coding assistant (Anthropic Claude), directed and reviewed by the team.

**Background reading**
- UNESCO Man and the Biosphere Programme: Tonle Sap Biosphere Reserve
- Mekong River Commission: Tonle Sap flood pulse and fisheries

---

## 30-second demo video script (English captions on every shot)
Voice-over: about 65 words, read calmly by a team member (a human voice needs no AI label).
Music: the app's own story score playing quietly underneath (see the AI note in the end card).

| Time | Screen (what to record) | Voice-over = burned-in caption |
|---|---|---|
| 0–4 s | **Your Story** opening for Tonle Sap: radar images drifting behind the title. Hold still. | "Floods hide under clouds and forests, where cameras can't see." |
| 4–9 s | Click **Begin the story**. Chapter 1: the cloud bars grow. | "At Tonle Sap, clouds covered the sky on nine of ten satellite passes." |
| 9–15 s | Chapter 2 radar flipbook, then Chapter 3 hidden-water bars and the "1,704 km²" figure. | "NISAR's radar sees through, and finds water hidden under the trees: 1,700 square kilometres." |
| 15–21 s | Scroll to the top. In **Choose your place**, type "Dhaka, Bangladesh", press **Tell it**, the new story appears. | "Choose any place on Earth. DELTA PULSE reads real NISAR data live, and tells its story." |
| 21–26 s | Chapter 5: the evidence labels (OBSERVED, CALCULATED, INTERPRETED, UNCONFIRMED). | "Every claim is labelled, so you know what's measured and what's not." |
| 26–30 s | End card (see below). | "DELTA PULSE. Revealing the water we cannot see." |

**End card text (static, 4 s):**
> DELTA PULSE: Revealing the water we cannot see
> Team RADAR UNIT · NASA Space Apps 2026 · "Dancing with the SARs"
> github.com/haricharanparna/Radar-Unit
> *Real NASA-ISRO NISAR data. App code, story script and music were made with AI assistance (Anthropic Claude).*

**Before recording**
- Run the app locally with the backend on (`npm run dev` and `npm.cmd run api`), and run the Dhaka story once beforehand, so it appears in about 2 seconds on camera instead of about 30.
- Use Edge or Chrome at 1920×1080, zoom 110%, light or dark theme (pick one and keep it), sidebar collapsed.
- Turn the app's narrator off (player → VO) so it doesn't talk over the voice-over; keep the music on, quiet.

**Recording and editing (free, on Windows)**
- Record the screen with Xbox Game Bar (Win + Alt + R) or OBS. Record each shot separately; it's easier to trim.
- Edit in Clipchamp (built into Windows): cut each shot to the times above, add the captions as text, record the voice-over, export 1080p.
- **Check the length is 30 s or less** before uploading.
- Upload to YouTube as **Unlisted** (anyone with the link can watch; no sign-in), and paste the full `https://youtu.be/...` link into the Demo field.
- Don't use NASA logos in the video or the end card.

## Backup: 7-slide outline
1. **Title:** DELTA PULSE, "Revealing the water we cannot see", team, challenge.
2. **Problem:** forest canopy and clouds hide floodwater (Tonle Sap: flooded forest invisible to cameras; 9 of 10 passes cloudy).
3. **Why NISAR:** 24 cm L-band reaches under the canopy (double bounce off water and trunks), unlike shorter-wavelength radars; also through cloud and darkness; every 12 days, worldwide.
4. **What we built:** live search, remote chunk reading, Fingerprint, Your Story (screenshots).
5. **Results:** Tonle Sap flood pulse (water-under-vegetation signature about 6.6× larger at its 11 Sep peak, +48% water-like area); live examples.
6. **Why trust it:** independent checks (82% of JRC permanent water found, ~0% false alarms; tracks river flow r = 0.81), quality masks, fair comparisons, sensitivity test, evidence labels, 32 tests.
7. **Impact and next steps:** users, gauge calibration, alerts, languages, GitHub link.

## Eligibility checklist
- [ ] All members registered for the same Local Event and listed on the team page
- [ ] Every required field completed, in English
- [ ] Demo: 30-second video with English captions (or ≤7 slides)
- [ ] References field filled in (above)
- [ ] Both confirmation boxes ticked
- [ ] **Submit** clicked before Sunday 15 Nov, 11:59 pm local time
