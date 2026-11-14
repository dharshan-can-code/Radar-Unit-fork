# Data sources

| Dataset | Use | Resolution | Coverage / dates | Access / licence | Status |
|---|---|---|---|---|---|
| **NISAR L2 GCOV** (NASA-ISRO, ASF DAAC), collections `NISAR_L2_GCOV_PROVISIONAL_V1` (CRID P05023) and `NISAR_L2_GCOV_V1` (P05036) | Core radar measurements (HH, HV gamma-naught) | 20 m posting for the 20 MHz mode used here | Tonle Sap track 83A: 2026-06-19 → 2026-10-17 (10 dates) | Free; NASA Earthdata Login required for files; search metadata is public | **Used**: all 10 dates downloaded and processed; live search and remote reads worldwide |
| ASF Search API (`asf_search` 14.1.0) | Discovery and inventory | — | — | Public | **Used** |
| ASF NISAR Data User Guide (nisar-docs.asf.alaska.edu) | Product structure, maturity levels, documented data gap 2026-07-27 → 2026-08-10 | — | — | Public | **Used** |
| Esri World Dark Gray Base / World Imagery | Basemap and **optical context only** (not time-matched) | varies | global | Esri terms, attribution shown | **Used** in app |
| JRC Global Surface Water | Calibrating the open-water screening on permanent water | 30 m | 1984–2021 | Free (Copernicus) | Planned |
| ESA WorldCover | Separating tree cover and built-up land (double-bounce look-alikes) | 10 m | 2021 | CC-BY 4.0 | Planned |
| Mekong River Commission hydrometric data (e.g. Kampong Luong, Prek Kdam) | Lake water level at acquisition times | point | check 2026 availability | MRC data portal (registration may be needed) | Planned; **verify access** |
| NASA GPM IMERG | Rainfall context | 0.1° | daily | NASA GES DISC, Earthdata Login | Planned |
| ERA5 / ERA5T reanalysis via Open-Meteo | Rainfall and cloud cover at each pass (context only) | ~25 km | daily and hourly | Free, no key, CC BY 4.0 | **Used** in app |
| GloFAS v4 river discharge via Open-Meteo Flood API | River flow history and forecast (context only) | ~5 km | daily | Free, no key, CC BY 4.0 | **Used** in app |
| NASA GIBS / Worldview (MODIS Terra and Aqua, VIIRS SNPP true colour) | Same-day optical image beside the radar | 250 m–1 km | daily | Free, no key | **Used** in app |
| AWS Terrain Tiles (SRTM, USGS and others) | 3D terrain view | ~30 m | static | Free | **Used** in app |
| Barataria alternative: CRMS, NOAA 8761724 Grand Isle, USFWS NWI, USGS 3DEP | Validation if the second site is added | varies | — | Public | Not started |

Supporting datasets must stay visually distinct from NISAR measurements in the app. A gauge or rainfall value never validates individual pixels by itself.
