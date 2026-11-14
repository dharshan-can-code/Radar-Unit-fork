"""Place-name search via OpenStreetMap Nominatim.

Usage policy: max 1 request/second, identify the application, cache results.
https://operations.osmfoundation.org/policies/nominatim/
"""
from __future__ import annotations

import threading
import time

import requests

URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "DeltaPulse/0.2 (NASA Space Apps student project; open source)"}
_lock = threading.Lock()
_last = 0.0
_cache: dict[str, list] = {}


def geocode(q: str, limit: int = 6) -> list[dict]:
    q = " ".join(q.split())[:200]
    if not q:
        return []
    key = f"{q.lower()}|{limit}"
    if key in _cache:
        return _cache[key]
    global _last
    with _lock:  # respect 1 request / second
        wait = 1.0 - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        r = requests.get(URL, params={"q": q, "format": "jsonv2", "limit": limit}, headers=HEADERS, timeout=20)
        _last = time.time()
    r.raise_for_status()
    out = [{"name": d.get("display_name"), "lat": float(d["lat"]), "lon": float(d["lon"]),
            "type": d.get("type"), "bbox": [float(v) for v in d.get("boundingbox", [])] or None}
           for d in r.json()]
    _cache[key] = out
    return out
