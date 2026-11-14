"""Tests for scripts/validation/validate_area.py (no network)."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts" / "validation"), str(ROOT / "scripts"), str(ROOT / "scripts" / "processing")]
import validate_area as V  # noqa: E402
import radar  # noqa: E402

SCREENING = json.loads((ROOT / "scripts" / "processing" / "screening.json").read_text())


def test_jrc_tile_name():
    assert V.jrc_tile_name(103.55, 13.35) == "occurrence_100E_20Nv1_4_2021.tif"
    assert V.jrc_tile_name(-90.25, 29.70) == "occurrence_100W_30Nv1_4_2021.tif"
    assert V.jrc_tile_name(-60.0, -3.1) == "occurrence_60W_0Nv1_4_2021.tif"


def test_lzw_decode_matches_pillow(tmp_path):
    """Write an LZW TIFF with Pillow, then decode its raw strip with our decoder."""
    rng = np.random.default_rng(0)
    a = np.where(rng.random((64, 64)) < 0.7, 0, rng.integers(0, 101, (64, 64))).astype(np.uint8)
    a[10:30, 5:50] = 100  # long runs exercise the code table and width changes
    p = tmp_path / "t.tif"
    Image.fromarray(a).save(p, compression="tiff_lzw")
    im = Image.open(p)
    offsets, counts = im.tag_v2[273], im.tag_v2[279]
    rows_per_strip = im.tag_v2.get(278, 64)
    out = []
    with open(p, "rb") as fh:
        for off, n in zip(offsets, counts):
            fh.seek(off)
            out.append(V.lzw_decode(fh.read(n)))
    got = np.frombuffer(b"".join(out), np.uint8)[: a.size].reshape(a.shape)
    assert rows_per_strip > 0
    assert np.array_equal(got, a)


def test_distance_km():
    m = np.zeros((5, 7), bool)
    m[2, 0] = True
    d = V.distance_km(m, res_m=200)
    assert d[2, 0] == 0
    assert d[2, 3] == 0.6  # three cells east
    assert d[0, 2] == 0.4  # diagonal steps count as one cell


def test_classify_matches_pipeline_screening():
    rng = np.random.default_rng(1)
    hh = rng.uniform(-28, 2, (40, 40)).astype(np.float32)
    hv = rng.uniform(-34, -5, (40, 40)).astype(np.float32)
    hh[0, :5] = np.nan
    hv[1, :5] = np.nan
    water, double, fin = V.classify(hh, hv, SCREENING)
    cls = radar.screen(hh, hv, SCREENING)
    assert np.array_equal(water, cls == radar.LOW_BACKSCATTER)
    assert np.array_equal(double, cls == radar.DOUBLE_BOUNCE)
    assert np.array_equal(fin, cls != radar.NODATA)
