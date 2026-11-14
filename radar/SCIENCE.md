# Science and methods

## Question
How can NISAR radar observations help reveal possible flooding and environmental change that is difficult to observe with optical imagery alone?

## Physics in one paragraph
NISAR's L-band SAR (about 24 cm wavelength) measures backscatter: the fraction of its own pulse that returns.
- **Calm open water** reflects the pulse away like a mirror, so it appears very dark in both HH and HV.
- **Dry vegetation** scatters in many directions (volume scattering), giving a relatively strong **HV**.
- **Water under trunks and stems** forms a corner reflector, called **double bounce**. It makes **HH** very bright with a large HH−HV difference.

Buildings produce the same double-bounce signature, and wind, smooth soil, rain-wet leaves and crop growth all change backscatter too. **A radar change alone cannot prove flooding.**

## Data
NISAR L2 **GCOV**: geocoded, radiometrically terrain-corrected polarimetric covariance (gamma-naught), in HDF5. DELTA PULSE uses only the frequency-A **diagonal terms** `HHHH` and `HVHV`, which are real-valued linear power. Off-diagonal terms are complex. They are not intensities and are not used.

## Processing (`scripts/processing/process_stack.py`)
1. Read file metadata. **Refuse** to mix processing releases (CRIDs), projections, or synthetic and real files. **Refuse** duplicate dates.
2. Define one target grid over the study area in the products' UTM CRS, with 100 m cells.
3. For each observation and channel, bin source pixels onto that grid by **mean linear power**. Samples that are non-finite, ≤ 0, or equal to `_FillValue` are excluded. Every date is therefore pixel-aligned by construction.
4. Drop cells where fewer than 50% of their source pixels are valid.
5. `dB = 10·log10(power)`, defined only for power > 0.
6. Change = `dB(after) − dB(before)`, consecutive dates only. NaN wherever either date is invalid.
7. Screening (`screening.json`, **UNCALIBRATED**):
   - *low backscatter*: HH < −18 dB and HV < −25 dB
   - *double-bounce signature*: HH > −6 dB and HH−HV > 7 dB. Needs HV, so HH-only dates can only be screened for low backscatter.
8. Outputs:
   - PNG overlays (fixed dB stretch, so dates are visually comparable)
   - a 200 m inspection grid (`grid.bin`, Int16 dB×100) used by the browser for region statistics
   - `manifest.json` with every observation's scene name, CRID, maturity, channels and valid fraction

## Radar Change Fingerprint (`lib/data.ts`)
For a selected region and pair:
- region mean before/after per channel (averaged in linear power, reported in dB)
- Δ of the means
- per-cell Δ median, p10 and p90
- share of cells with |Δ| ≥ 3 dB
- a histogram of Δ
- the HH−HV difference before and after
- screening shares
- valid coverage
- a time series of all dates

The interpretation rules map these numbers to one of four verdicts: *Possible inundation-related signal*, *Radar change detected*, *No significant radar change* or *Insufficient evidence*. Each verdict comes with evidence-tagged statements. The rules always state the alternative explanations and the missing validation.

A region is flagged *Possible inundation-related signal* when (a) HH brightens by ≥ 3 dB and HH−HV rises by ≥ 3 dB, (b) both channels darken by ≥ 3 dB to open-water levels, or (c) the share of cells with the double-bounce signature rises by ≥ 20 percentage points while HH brightens and HH−HV rises. Rule (c) is the same mechanism as (a), counted per cell, so a flood under part of a region is not averaged away by the unaffected cells.

## Independent checks (`scripts/validation/validate_area.py`)
Compares the screening with data never used to build it and writes `public/data/<area>/validation.json`, shown under *Methods*:
- **JRC Global Surface Water occurrence** (Landsat 1984–2021), sampled 25 times per 200 m cell. *Permanent* = whole cell water in at least 90% of observations; *never wet* = whole cell never seen as water. Reports how much permanent water the water-like class finds and how much never-wet land it flags, per date, plus a threshold sweep.
- **Flooded vegetation by distance** from JRC permanent water: real flooding under canopy should concentrate near the lake; crops or wet leaves should not.
- **GloFAS v4 modelled river discharge** on each pass date (main channel within ±0.1° of two reference points chosen in advance), correlated with radar areas.
- **ERA5 10 m wind** at each pass time, to test whether wind roughening explains missed open water.
- A **featured example region** for the app (a 10 × 10 km box on the flooded-forest belt with the strongest signal), labelled as a showcase.

Results for Tonle Sap: a median 82% of permanent water found (60–98% by date) and at most 0.1% of never-wet land flagged. On never-wet land 5–20 km from the lake, the flooded-vegetation signature rose from about 4% to 22–24% of cells, versus 4% to 12% beyond 40 km. Radar water plus flooded-vegetation area vs Tonle Sap River flow: r = 0.81 (n = 10). Wind was 0.5–4.2 m/s and does not explain the two lower-detection dates.

## Why 3 dB?
+3 dB is a doubling of power. Below about 3 dB at 100–200 m aggregation, differences can come from speckle, moisture or calibration. This is a screening level, not a detection threshold.
