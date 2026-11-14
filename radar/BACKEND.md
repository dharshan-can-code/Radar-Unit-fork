# DELTA PULSE backend: any place on Earth, live NISAR data

A FastAPI server that lets the app search for **any place name**, find every NISAR L2 GCOV acquisition over it **live from the ASF archive**, and analyse a 2–40 km window around it. It reads only the bytes it needs straight from NASA's servers, with no 1.9 GB downloads.

## Run
From the `radar` folder:
```powershell
npm.cmd run api
# or: .\.venv\Scripts\python.exe -m uvicorn backend.app:app --port 8000
```
Open http://localhost:8000/docs for interactive API docs. Analysis needs the Earthdata token in `.earthdata_token`; search works without it.

**Hosted front end.** The front end builds to static files (`npm run build`) and can be hosted on its own. Without the backend, the Tonle Sap case study, Your Story, rainfall, cloud and river data still work, because the browser calls Open-Meteo directly. Only live search and live analysis need this server. To let a hosted front end use a backend, set `NEXT_PUBLIC_API` to the backend URL at build time, and allow the front end's address on the server with `DELTA_PULSE_ORIGINS="https://your-demo.example"` (comma-separated).

## How "live" works (and what it is not)
- **Search is live.** Every new location queries the ASF archive at request time (results cached for 15 min; `?fresh=true` bypasses the cache).
- **Analysis reads the real file remotely.** ASF redirects the authenticated request to a short-lived signed URL. The backend then fetches only the needed 1 MB blocks with HTTP Range requests. GCOV is chunked 512×512 with paged metadata, so a 20 km window costs about 30–90 MB per acquisition instead of 1.9 GB.
- **Watched locations** are re-checked every 6 h while the server runs, and newly listed acquisitions are recorded (`/api/watch`).
- **NISAR itself is not real time.** It revisits each place about every 12 days, and products appear in the archive after processing. The newest data is whatever ASF has published. Every result carries its acquisition date and the time the archive was checked.

## Endpoints
| Method | Path | What |
|---|---|---|
| GET | `/api/health` | Server time; whether a token is configured |
| GET | `/api/geocode?q=Manaus` | Place name → coordinates (OpenStreetMap Nominatim, max 1 req/s, cached) |
| GET | `/api/acquisitions?lat=&lon=` | Live archive search, grouped into **compatible stacks** (same track, pass, frame, bandwidth, CRID and collection), most useful first, plus `recommended_stack` |
| POST | `/api/analyze` | `{lat, lon, scenes:[2–12 scene names from one stack], size_km: 2–40, place}` → job id |
| GET | `/api/jobs/{id}` | `status` (queued/running/done/error), `progress`, `message` |
| GET | `/api/results/{id}/manifest.json` | Result in the **same format as the batch pipeline**, plus `grid.bin` and `img/*.png` |
| GET/POST | `/api/watch` | List/add locations for the periodic archive check |
| GET | `/api/latest?days=3` | Newest NISAR GCOV acquisitions anywhere on Earth, live from ASF (cached 10 min) |
| GET | `/api/weather?lat=&lon=&start=&end=` | Daily rainfall (ERA5/ERA5T via Open-Meteo), context only |
| GET | `/api/gallery` | Previously computed analyses, newest first |

`/api/analyze` also takes `detail`: `"standard"` reads frequency A (main band, 40 m cells) and `"quick"` reads frequency B (5 MHz side band, 80 m cells).

Identical requests reuse the stored result instantly (`data/live/<id>/`, git-ignored).

## Scientific safeguards (enforced, tested)
- **PROVISIONAL**, **VALIDATED** and **URGENT RESPONSE** (`NISAR_UR_L2`, the fastest-published products) are analysed. Urgent-response stacks carry a caveat, because they aren't a validated science release. BETA (pre-calibration) is listed but refused.
- Acquisitions in one analysis must share track, pass, frame, bandwidth, release and collection. Releases and product lines are never mixed. When an urgent-response stack and a science release cover the same dates, the science release is recommended.
- Quality masks are applied for **both** file layouts found in real data:
  - P05023 (product 1.0.11): `mask` 1–254 valid, uint8 exception mask must be 0.
  - P05036 (product 1.0.20): additionally a uint16 exception mask whose low byte holds anomaly codes and whose bits 256/512 mark HH/HV as fully focused. 65535 = fill.
- If a location has no valid data on a date (outside the swath or masked), the job fails with that reason instead of returning empty numbers.

## Speed: parallel chunk prefetch
h5py reads a remote file one chunk at a time, about 0.6 s per HTTP round trip. Before reading, the backend asks the HDF5 index which compressed chunks the window needs (`get_chunk_info_by_coord`) and downloads them all **in parallel**. The quality masks are read once per acquisition, not once per channel.

Measured performance (2026-11-14, home connection):

| Request | Before | Now |
|---|---|---|
| Jakarta, 2 VALIDATED dates, detailed 40 m | ~60 s | **12.6 s** (96 MB) |
| Jakarta, 2 dates, quick 80 m | — | **8.8 s** (20 MB) |
| Aleutians, 2 dates, quick, in the browser end to end | — | **10.3 s** |
| Repeat of an identical request | — | instant |

## Privacy
- Place names typed by users are sent to OpenStreetMap Nominatim to find coordinates.
- Coordinates are sent to ASF to search the archive.
- No user identity is sent. The geocoder identifies only as "DeltaPulse".
