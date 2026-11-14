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
                                  "end_date": end, "daily": "precipitation_sum,cloud_cover_mean",
                                  "hourly": "cloud_cover", "timezone": "UTC"}, timeout=30)
    r.raise_for_status()
    js = r.json()
    d = js["daily"]
    daily = [{"date": t, "precip_mm": v, "cloud_pct": c}
             for t, v, c in zip(d["time"], d["precipitation_sum"], d.get("cloud_cover_mean", [None] * len(d["time"])))]
    h = js.get("hourly", {})
    hourly = [{"time": t, "cloud_pct": c} for t, c in zip(h.get("time", []), h.get("cloud_cover", [])) if c is not None]
    last = max((x["date"] for x in daily if x["precip_mm"] is not None), default=None)
    out = {"lat": lat, "lon": lon, "source": "Open-Meteo historical weather API",
           "dataset": "ERA5 / ERA5T reanalysis (ECMWF): daily precipitation and cloud cover; the most recent days are preliminary", "units": "mm/day",
           "latest_available": last, "license": "CC BY 4.0", "daily": daily, "hourly_cloud": hourly,
           "cloud_note": "Total cloud cover (% of sky) from the same reanalysis; hourly values let you check the sky at the satellite pass time."}
    _cache[key] = (time.time(), out)
    return out


# ---- river discharge (GloFAS) and current conditions --------------------------

FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
NOW_URL = "https://api.open-meteo.com/v1/forecast"


def river(lat: float, lon: float, past_days: int = 180, forecast_days: int = 30) -> dict:
    """Daily river discharge from GloFAS v4 (Copernicus Emergency Management Service) via
    Open-Meteo: modelled history plus the operational forecast. Snaps to the nearest
    5 km river cell, so for small streams it may describe a nearby larger river."""
    key = f"river|{lat:.3f},{lon:.3f}|{past_days}|{forecast_days}"
    if key in _cache and time.time() - _cache[key][0] < 3 * 3600:
        return _cache[key][1]
    r = requests.get(FLOOD_URL, params={"latitude": round(lat, 3), "longitude": round(lon, 3), "daily": "river_discharge",
                                        "past_days": past_days, "forecast_days": forecast_days}, timeout=30)
    r.raise_for_status()
    js = r.json()
    today = time.strftime("%Y-%m-%d", time.gmtime())
    d = js.get("daily", {})
    daily = [{"date": t, "discharge_m3s": v, "forecast": t > today}
             for t, v in zip(d.get("time", []), d.get("river_discharge", []))]
    vals = [x["discharge_m3s"] for x in daily if x["discharge_m3s"] is not None and not x["forecast"]]
    out = {"lat": lat, "lon": lon, "cell": [js.get("latitude"), js.get("longitude")],
           "source": "Open-Meteo Flood API", "dataset": "GloFAS v4 river discharge (Copernicus EMS), modelled; includes forecast",
           "units": "m³/s", "today": today, "license": "CC BY 4.0", "daily": daily,
           "has_river": bool(vals) and max(vals) > 0.5}
    _cache[key] = (time.time(), out)
    return out


def now(lat: float, lon: float) -> dict:
    """Current conditions (model analysis, updated every 15 min)."""
    key = f"now|{lat:.3f},{lon:.3f}"
    if key in _cache and time.time() - _cache[key][0] < 600:
        return _cache[key][1]
    r = requests.get(NOW_URL, params={"latitude": round(lat, 3), "longitude": round(lon, 3),
                                      "current": "temperature_2m,precipitation,rain,cloud_cover,weather_code,is_day",
                                      "timezone": "UTC"}, timeout=20)
    r.raise_for_status()
    js = r.json()
    out = {"lat": lat, "lon": lon, "source": "Open-Meteo forecast API (current conditions, 15-minute updates)",
           "current": js.get("current", {}), "units": js.get("current_units", {}), "license": "CC BY 4.0"}
    _cache[key] = (time.time(), out)
    return out
