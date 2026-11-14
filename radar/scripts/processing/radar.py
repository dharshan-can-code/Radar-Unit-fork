"""Pure radar calculations used by the DELTA PULSE pipeline.

Everything here is deterministic numpy so it can be unit-tested and
reproduced. Conventions:
  * Input backscatter is LINEAR POWER (GCOV diagonal covariance terms,
    e.g. HHHH = <|S_hh|^2>, gamma-naught RTC).
  * Averaging is always done in linear power, never in dB.
  * dB = 10 * log10(power), defined only for finite power > 0; everything
    else becomes NaN (invalid).
"""
from __future__ import annotations

import numpy as np


def to_db(power: np.ndarray) -> np.ndarray:
    """Convert positive linear power to dB. Zero, negative, NaN, inf -> NaN."""
    p = np.asarray(power, dtype=np.float64)
    out = np.full(p.shape, np.nan)
    ok = np.isfinite(p) & (p > 0)
    out[ok] = 10.0 * np.log10(p[ok])
    return out


def valid_power(a: np.ndarray, fill_value=None) -> np.ndarray:
    """Boolean mask of usable linear-power samples."""
    ok = np.isfinite(a) & (a > 0)
    if fill_value is not None and np.isfinite(fill_value):
        ok &= a != fill_value
    return ok


class GridAccumulator:
    """Aggregate source pixels onto a fixed target grid (same CRS) by
    averaging linear power. Because every observation is binned onto the
    *same* target grid, outputs are pixel-aligned by construction.

    Target grid: columns start at x0 and grow east, rows start at y1 (top)
    and grow south, square cells of size `res` (metres).
    """

    def __init__(self, x0: float, y1: float, res: float, nx: int, ny: int):
        self.x0, self.y1, self.res, self.nx, self.ny = x0, y1, res, nx, ny
        self.sum = np.zeros(nx * ny)
        self.n_valid = np.zeros(nx * ny)
        self.n_total = np.zeros(nx * ny)

    def add(self, x: np.ndarray, y: np.ndarray, values: np.ndarray, valid: np.ndarray):
        """x: (nx_src,), y: (ny_src,) pixel-centre coordinates; values/valid: (ny_src, nx_src)."""
        ix = np.floor((x - self.x0) / self.res).astype(np.int64)
        iy = np.floor((self.y1 - y) / self.res).astype(np.int64)
        okx = (ix >= 0) & (ix < self.nx)
        oky = (iy >= 0) & (iy < self.ny)
        if not okx.any() or not oky.any():
            return
        v = values[np.ix_(oky, okx)]
        m = valid[np.ix_(oky, okx)]
        idx = (iy[oky][:, None] * self.nx + ix[okx][None, :])
        size = self.nx * self.ny
        self.n_total += np.bincount(idx.ravel(), minlength=size)
        self.n_valid += np.bincount(idx[m], minlength=size)
        self.sum += np.bincount(idx[m], weights=v[m].astype(np.float64), minlength=size)

    def mean(self) -> np.ndarray:
        out = np.full(self.nx * self.ny, np.nan)
        ok = self.n_valid > 0
        out[ok] = self.sum[ok] / self.n_valid[ok]
        return out.reshape(self.ny, self.nx)

    def valid_fraction(self) -> np.ndarray:
        out = np.zeros(self.nx * self.ny)
        ok = self.n_total > 0
        out[ok] = self.n_valid[ok] / self.n_total[ok]
        return out.reshape(self.ny, self.nx)


def block_reduce_power(power: np.ndarray, valid_frac: np.ndarray, k: int):
    """Coarsen a grid by an integer factor k, averaging linear power over the
    valid cells (NaN-aware). Returns (power, valid_frac) of shape (ny//k, nx//k)."""
    ny, nx = power.shape
    ny2, nx2 = ny // k, nx // k
    p = power[: ny2 * k, : nx2 * k].reshape(ny2, k, nx2, k)
    f = valid_frac[: ny2 * k, : nx2 * k].reshape(ny2, k, nx2, k)
    ok = np.isfinite(p)
    s = np.where(ok, p, 0).sum(axis=(1, 3))
    n = ok.sum(axis=(1, 3))
    out = np.full((ny2, nx2), np.nan)
    out[n > 0] = s[n > 0] / n[n > 0]
    return out, f.mean(axis=(1, 3))


def change_db(before_db: np.ndarray, after_db: np.ndarray) -> np.ndarray:
    """after - before in dB; NaN wherever either is invalid."""
    return np.where(np.isfinite(before_db) & np.isfinite(after_db), after_db - before_db, np.nan)


# Screening classes (NOT confirmed land-cover / flood classes).
NODATA, LOW_BACKSCATTER, DOUBLE_BOUNCE, NO_SIGNAL = 0, 1, 2, 3


def screen(hh_db: np.ndarray, hv_db: np.ndarray | None, cfg: dict) -> np.ndarray:
    """Apply the configurable screening rules from screening.json.

    LOW_BACKSCATTER: very low HH (and HV if available) -> specular surface,
        consistent with open water (also: smooth bare soil, radar shadow).
    DOUBLE_BOUNCE: strong HH and large HH-HV difference -> consistent with
        water-trunk double-bounce under vegetation (also: buildings).
    Requires HV for DOUBLE_BOUNCE; HH-only observations can only be
    screened for LOW_BACKSCATTER.
    """
    ow, db = cfg["open_water"], cfg["double_bounce"]
    out = np.full(hh_db.shape, NODATA, dtype=np.uint8)
    ok = np.isfinite(hh_db)
    out[ok] = NO_SIGNAL
    water = ok & (hh_db < ow["hh_max_db"]["value"])
    if hv_db is not None:
        water &= ~(np.isfinite(hv_db) & (hv_db >= ow["hv_max_db"]["value"]))
        dbl = ok & np.isfinite(hv_db) & (hh_db > db["hh_min_db"]["value"]) & \
            ((hh_db - hv_db) > db["hh_minus_hv_min_db"]["value"])
        out[dbl] = DOUBLE_BOUNCE
    out[water] = LOW_BACKSCATTER
    return out


def region_power_stats(power: np.ndarray) -> dict:
    """Region summary in linear power, reported in dB."""
    v = power[np.isfinite(power) & (power > 0)]
    if v.size == 0:
        return {"n": 0}
    return {"n": int(v.size), "mean_db": float(10 * np.log10(v.mean())),
            "median_db": float(10 * np.log10(np.median(v))),
            "p10_db": float(10 * np.log10(np.percentile(v, 10))),
            "p90_db": float(10 * np.log10(np.percentile(v, 90)))}
