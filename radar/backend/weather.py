"""Rainfall context from Open-Meteo's historical weather API (ERA5 reanalysis).

ERA5 is a model reanalysis constrained by observations, ~5 days behind real time.
It is CONTEXT for interpreting radar change, never validation of a pixel.
https://open-meteo.com/en/docs/historical-weather-api  (free, no key, CC BY 4.0)
"""
from __future__ import annotations

import time
from datetime import date

import requests

URL = "https://archive-api.open-meteo.com/v1/archive"
_cache: dict[str, tuple[float, dict]] = {}


def rainfall(lat: float, lon: float, start: str, end: str) -> dict:
    date.fromisoformat(start), date.fromisoformat(end)  # validate
    key = f"{lat:.3f},{lon:.3f},{start},{end}"
    if key in _cache and time.time() - _cache[key][0] < 6 * 3600:
        return _cache[key][1]
    r = requests.get(URL, params={"latitude": round(lat, 3), "longitude": round(lon, 3), "start_date": start,
                                  "end_date": end, "daily": "precipitation_sum", "timezone": "UTC"}, timeout=30)
    r.raise_for_status()
    d = r.json()["daily"]
    daily = [{"date": t, "precip_mm": v} for t, v in zip(d["time"], d["precipitation_sum"])]
    last = max((x["date"] for x in daily if x["precip_mm"] is not None), default=None)
    out = {"lat": lat, "lon": lon, "source": "Open-Meteo historical weather API",
           "dataset": "ERA5 / ERA5T reanalysis (ECMWF), daily precipitation sum; the most recent days are preliminary", "units": "mm/day",
           "latest_available": last, "license": "CC BY 4.0", "daily": daily}
    _cache[key] = (time.time(), out)
    return out
