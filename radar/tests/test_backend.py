"""Offline tests for the live backend logic (no network)."""
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "scripts"), str(ROOT / "scripts" / "processing")]

import nisar  # noqa: E402
from analyze import AnalysisError, validate_request, window_grid  # noqa: E402


def g(date, **kw):
    base = dict(scene=f"S{date}", date=date, start_time=f"{date}T00:00:00Z", track=83, frame=8,
                direction="ASCENDING", collection="NISAR_L2_GCOV_PROVISIONAL_V1", maturity="PROVISIONAL",
                crid="P05023", pols=["HH", "HV"], bandwidth="20+5", url="u", footprint=None)
    return {**base, **kw}


def test_stacks_split_by_release_collection_and_dedupe_dates():
    gs = [g("2026-06-19"), g("2026-07-01"), g("2026-07-01"),  # duplicate date counted once
          g("2026-10-29", collection="NISAR_L2_GCOV_V1", maturity="VALIDATED", crid="P05036"),
          g("2026-11-04", collection="NISAR_UR_L2", maturity="OTHER"),  # same CRID, other product line
          g("2025-12-01", collection="NISAR_L2_GCOV_BETA_V1", maturity="BETA", crid="X05009")]
    stacks = nisar.group_stacks(gs)
    by = {s["id"]: s for s in stacks}
    assert by["t83A_f8_20-5_P05023"]["dates"] == ["2026-06-19", "2026-07-01"]
    assert by["t83A_f8_20-5_P05023_other"]["usable"] is False
    assert by["t83A_f8_20-5_X05009_beta"]["usable"] is False
    assert stacks[0]["id"] == "t83A_f8_20-5_P05023"  # usable stack with >=2 dates ranked first


def test_validate_request_rules():
    validate_request([g("2026-06-19"), g("2026-07-01")], 20)
    with pytest.raises(AnalysisError):  # mixing releases
        validate_request([g("2026-06-19"), g("2026-10-29", crid="P05036", maturity="VALIDATED",
                                             collection="NISAR_L2_GCOV_V1")], 20)
    with pytest.raises(AnalysisError):  # BETA never analysed
        validate_request([g("2025-12-01", maturity="BETA"), g("2025-12-13", maturity="BETA")], 20)
    with pytest.raises(AnalysisError):  # one date only
        validate_request([g("2026-06-19")], 20)
    with pytest.raises(AnalysisError):  # window too large
        validate_request([g("2026-06-19"), g("2026-07-01")], 100)


def test_window_grid_is_centred_and_bounded():
    x0, y1, res, nx, ny = window_grid(12.85, 104.05, 20, 32648)
    assert res == 40 and nx == ny == 500
    from pyproj import Transformer
    cx, cy = Transformer.from_crs(4326, 32648, always_xy=True).transform(104.05, 12.85)
    assert abs((x0 + nx * res / 2) - cx) <= res and abs((y1 - ny * res / 2) - cy) <= res
    assert window_grid(0, 0, 40, 32631)[2] == 80  # larger window -> coarser cells, <= ~500 px


def test_remote_file_reads_ranges_through_cache(monkeypatch):
    import remote_h5

    data = bytes(range(256)) * 40  # 10240 bytes

    class Resp:
        def __init__(self, status, content=b"", headers=None, url="https://signed"):
            self.status_code, self.content, self.headers, self.url = status, content, headers or {}, url

        def raise_for_status(self):
            pass

    calls = []

    def fake_get(self, url, headers=None, **kw):
        rng = headers["Range"].split("=")[1]
        a, b = map(int, rng.split("-"))
        calls.append((a, b))
        return Resp(206, data[a:b + 1], {"Content-Range": f"bytes {a}-{b}/{len(data)}"})

    monkeypatch.setattr(remote_h5.requests.Session, "get", fake_get)
    f = remote_h5.RemoteFile("https://asf/x.h5", "tok", block_size=1000, max_blocks=4)
    assert f.size == len(data)
    f.seek(995)
    assert f.read(10) == data[995:1005]  # spans two blocks
    f.seek(995)
    f.read(10)
    assert len(calls) == 3  # resolve + 2 blocks; second read served from cache
    f.seek(-5, 2)
    assert f.read(100) == data[-5:]
    assert np.isclose(f.tell(), len(data))


def test_urgent_response_is_its_own_labelled_stack():
    assert nisar.maturity_of("NISAR_UR_L2") == "URGENT_RESPONSE"
    gs = [g("2026-11-02"), g("2026-11-14", collection="NISAR_UR_L2", maturity="URGENT_RESPONSE"),
          g("2026-11-26", collection="NISAR_UR_L2", maturity="URGENT_RESPONSE")]
    by = {s["id"]: s for s in nisar.group_stacks(gs)}
    ur = by["t83A_f8_20-5_P05023_urgent_response"]
    assert ur["usable"] and ur["caveat"] and ur["dates"] == ["2026-11-14", "2026-11-26"]
    validate_request(ur["granules"], 20)                      # UR-only stack may be analysed
    with pytest.raises(AnalysisError):                        # but never mixed with a science release
        validate_request([gs[0], gs[1]], 20)


def test_quick_detail_uses_coarser_grid():
    assert window_grid(12.85, 104.05, 20, 32648, "quick")[2] == 80


def test_recommendation_prefers_science_release_on_ties():
    gs = [g("2026-10-26", collection="NISAR_UR_L2", maturity="URGENT_RESPONSE", crid="P05036"),
          g("2026-11-07", collection="NISAR_UR_L2", maturity="URGENT_RESPONSE", crid="P05036"),
          g("2026-10-26", collection="NISAR_L2_GCOV_V1", maturity="VALIDATED", crid="P05036"),
          g("2026-11-07", collection="NISAR_L2_GCOV_V1", maturity="VALIDATED", crid="P05036")]
    assert nisar.group_stacks(gs)[0]["maturity"] == "VALIDATED"
