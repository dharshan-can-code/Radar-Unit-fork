"""DELTA PULSE backend (FastAPI).

Endpoints
  GET  /api/health                         token + archive reachability
  GET  /api/geocode?q=...                  place name -> coordinates (OSM Nominatim)
  GET  /api/acquisitions?lat=..&lon=..     LIVE ASF search: NISAR GCOV covering the point, grouped into
                                           compatible stacks (same track/pass/frame/bandwidth/release)
  POST /api/analyze                        start an analysis job for 2..12 acquisitions of one stack
  GET  /api/jobs/{id}                      job progress / result
  GET  /api/results/{id}/...               manifest.json, grid.bin, img/*.png (same format as batch data)
  GET  /api/watch                          watched locations and what the scheduler found
  POST /api/watch                          add a location to the periodic archive check

Run (from the radar folder):
  .venv/Scripts/python -m uvicorn backend.app:app --port 8000
"""
from __future__ import annotations

import hashlib
import re
import json
import sys
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path[:0] = [str(HERE), str(ROOT / "scripts")]
import nisar  # noqa: E402
from analyze import AnalysisError, run_analysis, validate_request  # noqa: E402
from geocode import geocode  # noqa: E402
from weather import rainfall  # noqa: E402
from refresh import get_token  # noqa: E402

RESULTS = ROOT / "data" / "live"
RESULTS.mkdir(parents=True, exist_ok=True)
WATCH_FILE = ROOT / "data" / "metadata" / "watchlist.json"
CHECK_INTERVAL_S = 6 * 3600

app = FastAPI(title="DELTA PULSE API", version="0.2")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://localhost:3001",
                                                  "http://127.0.0.1:3000"], allow_methods=["*"], allow_headers=["*"])
app.mount("/api/results", StaticFiles(directory=RESULTS), name="results")

JOBS: dict[str, dict] = {}
POOL = ThreadPoolExecutor(max_workers=2)


_URL_RE = re.compile(r"https?://\S+")


def public_error(e: Exception) -> str:
    """Error text safe to show users: never includes (signed) URLs, which can carry account names."""
    from remote_h5 import ArchiveUnavailable
    if isinstance(e, ArchiveUnavailable):
        return str(e)
    msg = _URL_RE.sub("[archive URL hidden]", str(e))
    return f"{type(e).__name__}: {msg}"[:400]


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@app.get("/api/health")
def health():
    tok = get_token()
    return {"ok": True, "time_utc": now_utc(), "earthdata_token": bool(tok),
            "note": None if tok else "No Earthdata token: search works, analysis needs a token (.earthdata_token)."}


@app.get("/api/geocode")
def api_geocode(q: str = Query(..., min_length=2, max_length=200)):
    try:
        return {"query": q, "results": geocode(q)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"geocoding service unavailable: {e}") from e


def _public_stack(s: dict) -> dict:
    return {k: v for k, v in s.items() if k != "granules"} | {
        "granules": [{k: v for k, v in g.items() if k != "footprint"} for g in s["granules"]],
        "footprint": s["granules"][-1]["footprint"] if s["granules"] else None}


@app.get("/api/acquisitions")
def api_acquisitions(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
                     fresh: bool = False):
    try:
        res = nisar.search_point(lat, lon, use_cache=not fresh)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"ASF search failed: {e}") from e
    stacks = [_public_stack(s) for s in res["stacks"]]
    best = next((s for s in stacks if s["usable"] and s["n_dates"] >= 2), None)
    return {**{k: v for k, v in res.items() if k != "stacks"}, "stacks": stacks,
            "recommended_stack": best["id"] if best else None,
            "note": None if stacks else "NISAR has no GCOV products over this point in the archive yet."}


@app.get("/api/latest")
def api_latest(days: float = Query(3, gt=0, le=14), limit: int = Query(400, ge=10, le=2000)):
    """Newest NISAR GCOV acquisitions anywhere on Earth (live from ASF, cached 10 min)."""
    try:
        r = nisar.latest(days, limit)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"ASF search failed: {e}") from e
    return r


@app.get("/api/weather")
def api_weather(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
                start: str = Query(...), end: str = Query(...)):
    try:
        return rainfall(lat, lon, start, end)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"weather service unavailable: {e}") from e


@app.get("/api/gallery")
def api_gallery(limit: int = Query(30, ge=1, le=200)):
    """Previously computed analyses (newest first), so results can be reopened or shared."""
    items = []
    for mp in RESULTS.glob("*/manifest.json"):
        try:
            m = json.loads(mp.read_text())
        except Exception:  # noqa: BLE001
            continue
        o = m.get("observations", [])
        items.append({"id": mp.parent.name, "name": m.get("name"), "center": m.get("center"),
                      "generated_utc": m.get("generated_utc"), "detail": m.get("detail", "standard"),
                      "size_km": m.get("size_km"), "n_obs": len(o), "first": o[0]["date"] if o else None,
                      "last": o[-1]["date"] if o else None, "maturity": o[0].get("maturity") if o else None,
                      "result": f"/api/results/{mp.parent.name}/manifest.json"})
    items.sort(key=lambda i: i["generated_utc"] or "", reverse=True)
    return {"items": items[:limit]}


class AnalyzeRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    scenes: list[str] = Field(min_length=2, max_length=12)
    size_km: float = 20
    place: str | None = None
    detail: str = Field(default="standard", pattern="^(standard|quick)$")


def _job_key(req: AnalyzeRequest) -> str:
    raw = json.dumps([round(req.lat, 4), round(req.lon, 4), sorted(req.scenes), req.size_km, req.detail, "v2"])
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


@app.post("/api/analyze")
def api_analyze(req: AnalyzeRequest):
    token = get_token()
    if not token:
        raise HTTPException(503, "No Earthdata token configured on the server (.earthdata_token).")
    found = nisar.search_point(req.lat, req.lon)
    by_scene = {g["scene"]: g for s in found["stacks"] for g in s["granules"]}
    missing = [s for s in req.scenes if s not in by_scene]
    if missing:
        raise HTTPException(400, f"scenes not found over this point: {missing}")
    granules = [by_scene[s] for s in req.scenes]
    try:
        validate_request(granules, req.size_km)
    except AnalysisError as e:
        raise HTTPException(400, str(e)) from e

    key = _job_key(req)
    out = RESULTS / key
    if (out / "manifest.json").exists():  # identical request already computed: reuse
        return {"job_id": key, "status": "done", "cached": True, "result": f"/api/results/{key}/manifest.json"}
    if key in JOBS and JOBS[key]["status"] in ("queued", "running"):
        return {"job_id": key, **JOBS[key]}

    job = JOBS[key] = {"status": "queued", "progress": 0.0, "message": "Queued", "created_utc": now_utc()}

    def work():
        job["status"] = "running"

        def prog(msg, frac):
            job.update(message=msg, progress=round(frac, 3))
        try:
            # Write straight into the final folder; manifest.json appears only when complete.
            m = run_analysis(out, req.lat, req.lon, req.size_km, granules, token, req.place, prog, result_id=key, detail=req.detail)
            job.update(status="done", result=f"/api/results/{key}/manifest.json",
                       elapsed_s=m["processing"]["elapsed_s"], finished_utc=now_utc())
        except AnalysisError as e:
            job.update(status="error", message=str(e))
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            job.update(status="error", message=public_error(e))

    POOL.submit(work)
    return {"job_id": key, **job}


@app.get("/api/jobs/{job_id}")
def api_job(job_id: str):
    if job_id in JOBS:
        return {"job_id": job_id, **JOBS[job_id]}
    if (RESULTS / job_id / "manifest.json").exists():
        return {"job_id": job_id, "status": "done", "result": f"/api/results/{job_id}/manifest.json"}
    raise HTTPException(404, "unknown job")


# ---- watched locations + periodic archive check ---------------------------

def _load_watch() -> dict:
    return json.loads(WATCH_FILE.read_text()) if WATCH_FILE.exists() else {"locations": {}}


def _save_watch(w: dict):
    WATCH_FILE.write_text(json.dumps(w, indent=1))


_watch_lock = threading.Lock()


def check_location(loc: dict) -> dict:
    res = nisar.search_point(loc["lat"], loc["lon"], use_cache=False)
    scenes = {g["scene"]: g["date"] for s in res["stacks"] for g in s["granules"]}
    known = set(loc.get("known_scenes", []))
    new = sorted({d for s, d in scenes.items() if s not in known})
    loc.update(last_checked_utc=res["checked_utc"], known_scenes=sorted(scenes),
               latest_acquisition=max(scenes.values()) if scenes else None)
    if known and new:
        loc.setdefault("new_acquisitions", []).append({"found_utc": res["checked_utc"], "dates": new})
    return loc


class WatchRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    name: str | None = None


@app.post("/api/watch")
def api_watch_add(req: WatchRequest):
    with _watch_lock:
        w = _load_watch()
        k = f"{req.lat:.4f},{req.lon:.4f}"
        loc = w["locations"].setdefault(k, {"lat": req.lat, "lon": req.lon, "name": req.name, "added_utc": now_utc()})
        check_location(loc)
        _save_watch(w)
    return loc


@app.get("/api/watch")
def api_watch_list():
    return {"check_interval_hours": CHECK_INTERVAL_S / 3600, **_load_watch()}


def _scheduler():
    while True:
        time.sleep(CHECK_INTERVAL_S)
        with _watch_lock:
            w = _load_watch()
            for loc in w["locations"].values():
                try:
                    check_location(loc)
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
            _save_watch(w)


threading.Thread(target=_scheduler, daemon=True).start()
