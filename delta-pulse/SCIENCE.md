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

## Why 3 dB?
+3 dB is a doubling of power. Below about 3 dB at 100–200 m aggregation, differences can come from speckle, moisture or calibration. This is a screening level, not a detection threshold.
