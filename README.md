# DELTA PULSE: Revealing the Water We Cannot See

**Team RADAR UNIT · NASA Space Apps Challenge 2026 · "Dancing with the SARs"**

DELTA PULSE uses NASA-ISRO **NISAR L-band radar** to show water that cameras miss: floodwater spreading **under forest canopy**, and water hidden by cloud or darkness. Type any place on Earth and the app searches NASA's ASF archive live, reads only the needed parts of the real NISAR files, and shows what changed. Every statement is labelled **OBSERVED**, **CALCULATED**, **INTERPRETED** or **UNCONFIRMED**, so the app never claims a flood it cannot prove.

**Case study, Tonle Sap Lake (Cambodia), 10 NISAR passes, Jun–Oct 2026:** the radar signature of water under vegetation grew about 6.6×, from 260 to 1,704 km² at its 11 Sep peak, mostly within 20 km of the lake, and water-like ground grew 48% (1,829 → 2,703 km²). **Checked against independent data:** the water class finds a median 82% of Landsat's permanent water (JRC Global Surface Water) with almost no false alarms on dry land, and the radar's flooded area tracks modelled flow in the Tonle Sap River (r = 0.81 over the 10 dates). ERA5 cloud cover was above 50% at 9 of the 10 pass times.

![Tonle Sap 2026 season screening](radar/documentation/tonle_sap_2026_season_HH_screening.png)
*NISAR HH radar over Tonle Sap during the 2026 season. Cyan: water-like low backscatter. Orange: double-bounce signature consistent with water under trees. Screening classes, uncalibrated (see [LIMITATIONS](radar/LIMITATIONS.md)).*

**Live app:** https://delta-pulse-nisar.vercel.app

## Start here
| | |
|---|---|
| **The app and how to run it** | [radar/README.md](radar/README.md) |
| **For judges** | [radar/SUBMISSION.md](radar/SUBMISSION.md) |
| **User manual** | [radar/USER_MANUAL.md](radar/USER_MANUAL.md) (also `/guide` in the app) |
| **Science and methods** | [radar/SCIENCE.md](radar/SCIENCE.md) · [radar/LIMITATIONS.md](radar/LIMITATIONS.md) |
| **Live backend** | [radar/BACKEND.md](radar/BACKEND.md) |

## Quick start
```bash
cd radar
npm install
npm run dev        # http://localhost:3000, Tonle Sap case study and Your Story work without the backend
```
Live search anywhere on Earth also needs the Python backend and a free NASA Earthdata token (see [radar/BACKEND.md](radar/BACKEND.md)).

DELTA PULSE is a student project and is not an official NASA product.
