# DELTA PULSE: Space Apps 2026 submission kit

*Team RADAR UNIT · Challenge: "Dancing with the SARs" · deadline Sunday 15 Nov 2026, 11:59 pm local time*

Copy the sections below into the Project Submission page. Every number quoted comes from the app's real outputs.

---

## Project name
**DELTA PULSE: Revealing the Water We Cannot See**

## High-level summary (≈150 words)
Floods and wetlands change fastest when it's cloudy, exactly when ordinary satellite photos see nothing. Water spreading under forests is hidden even on clear days. DELTA PULSE makes NASA-ISRO **NISAR** L-band radar usable by anyone.

- **Any place, live:** type a place on Earth. The app searches NASA's ASF archive live, reads only the needed parts of the real NISAR GCOV files (no 1.9 GB downloads), and in about 10–15 seconds shows what changed: maps, a "Radar Change Fingerprint", a time series, and rainfall and cloud context.
- **Your Story:** turns any place into an animated story about the water hidden there.
- **Honest by design:** every statement is labelled *observed*, *calculated*, *interpreted* or *unconfirmed*, so the app never claims a flood it cannot prove.

In our Tonle Sap case study, clouds covered more than half the sky on 9 of 10 NISAR passes. NISAR's radar still saw water-like ground grow by about 62%, plus the flooded forest around the lake.

## Links
- **Code:** https://github.com/haricharanparna/Radar-Unit
- **Demo:** *(30-second video link)*
- **Guide for users:** `/guide` in the app

---

## How we addressed each judging criterion

### Impact
- **The problem:** hidden floodwater, under cloud and under forest, affects disaster response, fisheries, farming and drinking water.
- **Reach:** works for **any** location NISAR images, which is nearly all land every 12 days. The app's live feed shows hundreds of new products every few days.
- **Who it helps:** disaster responders, wetland and fisheries managers, farmers and water agencies, students and the public. See the in-app **Impact** section.
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
- **Sensitivity test:** the conclusions hold when the water threshold moves ±2 dB, for both the direction of change and the peak date.
- **Testing:** 28 automated tests, plus live end-to-end runs (Tonle Sap, Manaus, Sundarbans, Jakarta, Dhaka, Aleutians).
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
| Time | Screen | Caption / voice |
|---|---|---|
| 0–4 s | Story cover, "The water we cannot see in Tonle Sap" | "Floods hide under clouds and forests. Normal satellites can't see them." |
| 4–9 s | Chapter 1 cloud bars animate | "On 9 of 10 passes, clouds covered the sky. NISAR's radar saw through." |
| 9–15 s | Radar flipbook, then hidden-water bars | "Water-like ground grew 62%, and hidden flooded forest appeared." |
| 15–21 s | Type a new place in Your Story, steps tick, story appears | "Type any place on Earth. Real NASA data, read live, about 30 seconds." |
| 21–26 s | Chapter 5 tags (OBSERVED / INTERPRETED / UNCONFIRMED) | "Every claim is labelled. We show what we know, and what we don't." |
| 26–30 s | Logo, GitHub link | "DELTA PULSE: revealing the water we cannot see. Team RADAR UNIT." |

Record at 1080p with the browser zoomed to 110%. Keep the captions burned in.

## Backup: 7-slide outline
1. **Title:** DELTA PULSE, "Revealing the water we cannot see", team, challenge.
2. **Problem:** clouds and forest hide floodwater (Tonle Sap: 9 of 10 passes cloudy).
3. **NISAR:** L-band radar through cloud and canopy, every 12 days, worldwide.
4. **What we built:** live search, remote chunk reading, Fingerprint, Your Story (screenshots).
5. **Results:** Tonle Sap flood pulse (+62% water-like area, flooded forest peak on 11 Sep); live examples.
6. **Why trust it:** quality masks, fair comparisons, sensitivity test, evidence labels, 28 tests.
7. **Impact and next steps:** users, gauge calibration, alerts, languages, GitHub link.

## Eligibility checklist
- [ ] All members registered for the same Local Event and listed on the team page
- [ ] Every required field completed, in English
- [ ] Demo: 30-second video with English captions (or ≤7 slides)
- [ ] References field filled in (above)
- [ ] Both confirmation boxes ticked
- [ ] **Submit** clicked before Sunday 15 Nov, 11:59 pm local time
