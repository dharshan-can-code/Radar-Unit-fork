"""Tests for the DELTA PULSE data pipeline.

Run:  .venv/Scripts/python -m pytest -q
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "processing"))
sys.path.insert(0, str(ROOT / "scripts" / "discovery"))

import radar  # noqa: E402
from gcov_reader import open_info  # noqa: E402


# --- radar calculations -------------------------------------------------

def test_to_db_values_and_invalids():
    p = np.array([1.0, 0.1, 0.0, -1.0, np.nan, np.inf, 100.0])
    d = radar.to_db(p)
    assert d[0] == pytest.approx(0.0)
    assert d[1] == pytest.approx(-10.0)
    assert d[6] == pytest.approx(20.0)
    assert np.isnan(d[2:6]).all()  # zero, negative, nan, inf are invalid


def test_valid_power_respects_fill_value():
    a = np.array([0.5, -9999.0, 0.0, np.nan, 0.2])
    m = radar.valid_power(a, fill_value=-9999.0)
    assert m.tolist() == [True, False, False, False, True]


def test_accumulator_averages_linear_power_and_aligns():
    acc = radar.GridAccumulator(x0=0, y1=40, res=20, nx=2, ny=2)
    x = np.array([5.0, 15.0, 25.0, 35.0])          # 4 source cols of 10 m
    y = np.array([35.0, 25.0, 15.0, 5.0])          # 4 source rows (top -> bottom)
    v = np.array([[1, 3, 10, 10], [1, 3, 10, 10], [2, 2, 0.5, 0.5], [2, 2, np.nan, 0.5]], float)
    acc.add(x, y, v, radar.valid_power(v))
    m = acc.mean()
    assert m[0, 0] == pytest.approx(2.0)            # mean of 1,3,1,3 (linear, not dB)
    assert m[0, 1] == pytest.approx(10.0)
    assert m[1, 1] == pytest.approx(0.5)            # NaN excluded
    assert acc.valid_fraction()[1, 1] == pytest.approx(0.75)


def test_accumulator_ignores_out_of_grid_pixels():
    acc = radar.GridAccumulator(x0=0, y1=10, res=10, nx=1, ny=1)
    acc.add(np.array([5.0, 50.0]), np.array([5.0]), np.array([[1.0, 99.0]]), np.ones((1, 2), bool))
    assert acc.mean()[0, 0] == pytest.approx(1.0)


def test_change_db_nan_when_either_invalid():
    d = radar.change_db(np.array([-10.0, np.nan, -5.0]), np.array([-7.0, -3.0, np.nan]))
    assert d[0] == pytest.approx(3.0) and np.isnan(d[1]) and np.isnan(d[2])


def test_block_reduce_power_nan_aware():
    p = np.array([[1, 3, np.nan, np.nan], [1, 3, np.nan, np.nan]], float)
    out, vf = radar.block_reduce_power(p, np.ones_like(p), 2)
    assert out[0, 0] == pytest.approx(2.0) and np.isnan(out[0, 1])


def test_screening_rules_and_hh_only():
    cfg = json.loads((ROOT / "scripts/processing/screening.json").read_text())
    hh = np.array([-22.0, -2.0, -10.0, np.nan])
    hv = np.array([-30.0, -12.0, -15.0, np.nan])
    c = radar.screen(hh, hv, cfg)
    assert c.tolist() == [radar.LOW_BACKSCATTER, radar.DOUBLE_BOUNCE, radar.NO_SIGNAL, radar.NODATA]
    c2 = radar.screen(hh, None, cfg)               # HH-only: no double-bounce class possible
    assert radar.DOUBLE_BOUNCE not in c2.tolist()


# --- discovery logic ----------------------------------------------------

def test_pairs_only_within_compatible_groups_and_gap_detected():
    from discover import compatible_pairs, dedupe
    rows = []
    for d in ["2026-07-13", "2026-07-25", "2026-08-18"]:
        rows.append(dict(scene_name=f"A{d}", date=d, start_time=d, track=83, frame=8, direction="ASCENDING",
                         collection="P", maturity="PROVISIONAL", freqA_pols="HH+HV", range_bandwidth="20+5",
                         aoi_overlap_frac=1.0))
    rows.append(dict(rows[0], scene_name="B", collection="V", maturity="VALIDATED"))  # other release
    rows.append(dict(rows[0]))                                                       # exact duplicate
    df = dedupe(pd.DataFrame(rows))
    assert df.attrs["duplicates_removed"] == 1
    p = compatible_pairs(df)
    assert len(p) == 2                                   # never pairs PROVISIONAL with VALIDATED
    assert p.delta_days.tolist() == [12, 24] and p.nominal_repeat.tolist() == [True, False]


def test_real_inventory_has_no_duplicate_scenes():
    inv = ROOT / "data/metadata/inventory_tonle_sap.csv"
    if not inv.exists():
        pytest.skip("run discover.py first")
    df = pd.read_csv(inv)
    assert not df.duplicated(["scene_name", "collection"]).any()


# --- HDF5 reading + end-to-end on synthetic fixtures --------------------

@pytest.fixture(scope="module")
def fixtures(tmp_path_factory):
    from make_synthetic import make
    d = tmp_path_factory.mktemp("syn")
    return make(d, posting=400.0, dates=["20260713", "20260725", "20260818"], hv_missing=("20260725",))


def test_reader_parses_metadata(fixtures):
    i = open_info(fixtures[0])
    assert i.date == "2026-07-13" and i.epsg == 32648 and i.synthetic
    assert i.channels == ["HH", "HV"]
    assert open_info(fixtures[1]).channels == ["HH"]   # missing channel is detected, not assumed


def test_end_to_end_synthetic(fixtures, tmp_path):
    from process_stack import run
    m = run("tonle_sap", [str(p) for p in fixtures], res=800.0, out_dir=tmp_path)
    assert m["is_demonstration"] is True                 # demo data is always flagged
    assert [o["date"] for o in m["observations"]] == ["2026-07-13", "2026-07-25", "2026-08-18"]
    assert [p["delta_days"] for p in m["pairs"]] == [12, 24]
    assert m["pairs"][0]["channels"] == ["HH"]            # HV change not computed when HV missing
    g = np.fromfile(tmp_path / "grid.bin", dtype=np.int16).reshape(m["grid"]["shape"])
    assert (g[1, 1] == -32768).all()                     # HV of HH-only date is nodata
    assert (g[0, 0][g[0, 0] != -32768] < 2000).all()     # dB*100 plausibly < +20 dB
    assert (tmp_path / "img" / "2026-07-13_HH.png").exists()


def test_refuses_duplicate_dates(fixtures, tmp_path):
    from process_stack import run
    with pytest.raises(SystemExit):
        run("tonle_sap", [str(fixtures[0]), str(fixtures[0])], res=800.0, out_dir=tmp_path)


def test_quality_mask_semantics():
    from gcov_reader import quality_ok
    mask = np.array([0, 1, 2, 255], np.uint8)
    exc = np.array([0, 0, 2, 0], np.uint8)
    assert quality_ok(mask, exc).tolist() == [False, True, False, False]
    assert quality_ok(None, None) is True
