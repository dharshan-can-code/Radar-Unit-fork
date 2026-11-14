# DELTA PULSE backend: any place on Earth, live NISAR data

A FastAPI server that lets the app search for **any place name**, find every NISAR L2 GCOV acquisition over it **live from the ASF archive**, and analyse a 2–40 km window around it. It reads only the bytes it needs straight from NASA's servers, with no 1.9 GB downloads.

## Run
From the `radar` folder:
```powershell
npm.cmd run api
# or: .\.venv\Scripts\python.exe -m uvicorn backend.app:app --port 8000
```
Open http://localhost:8000/docs for interactive API docs. Analysis needs the Earthdata token in `.earthdata_token`; search works without it.

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

Identical requests reuse the stored result instantly (`data/live/<id>/`, git-ignored).

## Scientific safeguards (enforced, tested)
- Only **PROVISIONAL** and **VALIDATED** products are analysed. BETA (pre-calibration) and other product lines (e.g. `NISAR_UR_L2` urgent-response) are listed but refused.
- Acquisitions in one analysis must share track, pass, frame, bandwidth, release and collection. Releases are never mixed.
- Quality masks are applied for **both** file layouts found in real data:
  - P05023 (product 1.0.11): `mask` 1–254 valid, uint8 exception mask must be 0.
  - P05036 (product 1.0.20): additionally a uint16 exception mask whose low byte holds anomaly codes and whose bits 256/512 mark HH/HV as fully focused. 65535 = fill.
- If a location has no valid data on a date (outside the swath or masked), the job fails with that reason instead of returning empty numbers.

## Measured performance (2026-11-14, home connection)
| Location | Acquisitions | Time | Transfer |
|---|---|---|---|
| Manaus (VALIDATED, 10 m product) | 2 | 59 s | 92 MB |
| Sundarbans (PROVISIONAL) | 5 | 154 s | 255 MB |
| Repeat of an identical request | — | instant | 0 |

## Privacy
- Place names typed by users are sent to OpenStreetMap Nominatim to find coordinates.
- Coordinates are sent to ASF to search the archive.
- No user identity is sent. The geocoder identifies only as "DeltaPulse".
