# DELTA PULSE: User Manual

*RADAR UNIT · NASA Space Apps Challenge 2026*

DELTA PULSE shows how the ground and water around any place on Earth changed between NASA-ISRO **NISAR** radar passes. Radar sees through clouds and works at night, so it can show flooding and wetland change that ordinary satellite photos miss.

You do **not** need to know anything about radar to use it. In the app, click **User guide** (top right) for an illustrated version of this guide, or **How to use** for a one-minute summary.

> Running the app yourself for the first time? See [Setting up the app](#8-setting-up-the-app-for-whoever-runs-it) at the end.

---

## 1. The screen at a glance

| Area | What it is |
|---|---|
| **Header** | The project, a **How to use** button, and the data-status panel: when NASA's archive was last checked and what's loaded |
| **Explore anywhere** | Search box for any place or coordinates |
| **Newest NISAR acquisitions worldwide** | A live world map and list of everything NISAR captured in the last 24 hours, 3 days or 7 days |
| **01 Hidden Water Explorer** | The main map |
| **02 Radar Change Fingerprint** | Numbers, charts and an explanation for the area you selected |
| **03 Observation Timeline** | Every acquisition date, plus how much changed between each pair |
| **04 How radar sees wetlands** | A plain-language science explainer |
| **05 Methods, data and limitations** | Exactly how every number was made |

---

## 2. Tonle Sap case study (opens first)

The app opens on **Tonle Sap Lake, Cambodia**: 10 real NISAR acquisitions from 19 June to 17 October 2026, covering the monsoon flood season.

1. **Pick a pair of dates** with the buttons above the map (e.g. `09-11 → 09-23`). A red number like `24d` means the gap was longer than NISAR's usual 12 days.
2. **Compare:** drag the round **⇔** handle left and right. The left side is *before*, the right side is *after*.
3. **Switch views:**
   - **Before / After**: the radar images. Dark means smooth surfaces such as calm water. Bright means rough surfaces, buildings or flooded trees.
   - **Measured change**: **amber** got brighter, **blue** got darker.
   - **Screening**: cyan marks spots that *may* be open water. Amber marks spots that *may* be flooded vegetation (or buildings).
4. **HH / HV** switches between the two radar channels. HH is most sensitive to water and flooded vegetation; HV to plants and forest.
5. **Opacity** fades the radar layer so you can see the map underneath.
6. **Optical context** switches to a satellite photo basemap. It isn't from the same date, so use it only to recognise places.

---

## 3. Inspecting an area: the Radar Change Fingerprint

- **Click** the map to inspect a small spot (about 600 m × 600 m in the case study).
- Or press **Draw region** and drag a box.
- Press **Whole area** to go back to the full view.
- The Tonle Sap case study opens on a **featured 10 × 10 km box** on the flooded-forest belt, at the 12-day interval where water under the trees appeared fastest. It is a showcase: press **Whole area** or draw your own box for unbiased numbers.
- The **Independent checks** panel (under *Methods*) compares the radar with Landsat's water record, river flow and wind.

The Fingerprint section then shows:

| Part | Meaning |
|---|---|
| **Verdict** | One of *Possible inundation-related signal*, *Radar change detected*, *No significant radar change* or *Insufficient evidence* |
| **Statements** | Each statement is tagged by how certain it is (see below) |
| **HH / HV cards** | Average radar brightness before and after, and the change in dB. +3 dB means twice as bright. |
| **Histogram** | How many spots got brighter or darker |
| **Screening share** | How much of the area looks water-like or flooded-vegetation-like on each date |
| **Data quality** | How much of the area had valid data, the gap in days, and the product release |
| **Through time** | The area's radar brightness on every date |
| **Daily rainfall** | Rain at that location from the ERA5 weather reanalysis, for context |
| **CSV** button | Downloads all of these numbers as a spreadsheet file |

### The four labels
| Label | Meaning |
|---|---|
| **OBSERVED** | Measured directly (by NISAR, or a dataset such as rainfall) |
| **CALCULATED** | Maths on the measurements: averages, differences |
| **INTERPRETED** | A *possible* explanation. Other explanations are listed too. |
| **UNCONFIRMED** | Needs more evidence before anyone relies on it |

**DELTA PULSE never says an area is flooded.** Radar change has several possible causes, so the app lists what extra evidence would confirm it: a water-level gauge, a cloud-free photo or a field visit.

---

## 4. Exploring anywhere in the world

You can start in any of three ways:

1. **Type** a place name ("Manaus", "Sundarbans", "Jakarta") or coordinates ("22.02, 89.31") in the search box, then press **Search**. If several places match, click the right one.
2. **Click a footprint** on the *Newest NISAR acquisitions worldwide* map, or a row in its list.
3. On the main map, press **Analyse a new place here**, then click anywhere.

DELTA PULSE then searches NASA's archive **right now** and lists the **stacks** available there. A stack is a set of images taken from the same orbit track, so they can be compared fairly.

**Choosing what to analyse:**

1. **Stack:** the best one, with the newest comparable pair, is already selected. Badges show the product type:
   - **VALIDATED** (green): NASA's fully validated release.
   - **PROVISIONAL** (cyan): calibrated, partially validated.
   - **URGENT RESPONSE** (amber): the newest data, published quickly for events. It isn't a validated science release, and the app warns you when you pick it.
   - Greyed-out stacks are pre-calibration test data and can't be analysed.
2. **Dates:** click date buttons to select 2–12. Consecutive selected dates become comparison pairs. An amber `HH` on a date means HV wasn't recorded that day.
3. **Detail:**
   - **Quick 80 m**: about 10 seconds. Uses NISAR's coarser side band.
   - **Detailed 40 m**: about 15 seconds for two dates.
4. **Window:** 10, 20 or 40 km around the point.
5. Press **Analyse**. A progress bar and timer show the progress. The whole page then switches to your place, with a **Live:** bar above the map.

**After the analysis:**
- **Share link** copies a link that reopens exactly this result.
- **Change map** downloads the change image. **Data (JSON)** opens all the numbers and their sources.
- **Recent analyses** (under the search box) reopens earlier results instantly.
- **← Tonle Sap case study** goes back.

---

## 4b. Your Story: an animated story of any place
Click **✦ Your Story** in the top bar, type a place (your hometown works) and press **Tell its story**. In 20–40 seconds DELTA PULSE reads the newest real NISAR images of that place and writes a scrolling story. Press **Play the story** to watch it play automatically. The chapters are:
1. **Above the clouds:** how cloudy the sky was at the exact hour of each satellite pass (ERA5).
2. **What the radar saw:** an animation of every radar image.
3. **The hidden water:** water-like and hidden-under-vegetation area on each pass. It counts only ground the satellite saw every time, so the comparison is fair.
4. **The moment it changed:** the biggest change between two passes, plus rain in the week before.
5. **How sure are we?:** every statement labelled by certainty, and what would confirm it.

**Share this story** copies a link that opens the same story.

The **top bar** links to every section (Explore, Map, Fingerprint, Timeline, Impact, Science, Methods), Your Story, and the User guide.

## 4c. More tabs
| Tab | What it does |
|---|---|
| **Globe** | A spinning 3D globe of NISAR's newest images (last 24 h, 3 days or 7 days). Click one to explore it. |
| **Water Now** | Live weather now; river flow for the past 6 months plus a 30-day forecast (GloFAS); NASA's camera photo from the same day as each radar pass, with a slider. If one satellite missed that day, the next is tried automatically. |
| **Scatter Lab** | Every real radar pixel plotted HH vs HV. Drag the threshold lines to see the map and areas change. |
| **Radar Lab** | An interactive teaching model: water, trees, wind and wavelength. It shows why L-band sees under forest. |
| **3D terrain** (map toolbar) | Lays the radar over real elevation. "Basemap: NASA same day" shows NASA's photo from that date underneath. |
| **Sound** (Your Story) | Narration, rain that follows real rainfall, and "Hear the water": one note per pass. |

## 5. Where the data comes from (nothing is simulated)

| Data | Source | How fresh |
|---|---|---|
| NISAR L-band radar (GCOV) | NASA ASF DAAC archive, read live | Searched at the moment you ask. NISAR passes each place about every 12 days, and products appear after processing. |
| Newest acquisitions feed | ASF archive search | Re-checked whenever you open it or press refresh |
| Rainfall and cloud cover | ERA5 / ERA5T reanalysis via Open-Meteo | Updated daily. The last few days are preliminary. |
| Weather right now | Open-Meteo forecast API | Every 15 minutes |
| River flow and forecast | GloFAS v4 (Copernicus Emergency Management Service) via Open-Meteo | Daily, with a 30-day forecast. Modelled, not a gauge. |
| Same-day camera photos | NASA GIBS / Worldview (MODIS Terra and Aqua, VIIRS) | Daily |
| Terrain for 3D | AWS Terrain Tiles (SRTM and others) | Static |
| Place names | OpenStreetMap Nominatim | Live |
| Basemaps | Esri | Background only |

Every result shows each image's acquisition date and when the archive was checked.

**Privacy:** the place names you type go to OpenStreetMap, and coordinates go to NASA ASF and Open-Meteo. No personal information is sent.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| "Backend not reachable" | Start it: `npm.cmd run api` in the `radar` folder |
| "Analysis needs an Earthdata token" | Create `.earthdata_token` (see "Setting up the app", step 3). Tokens expire after about 60 days, so generate a new one if needed. |
| "No valid radar data at this location" | The point is at the edge of the satellite's strip or in a masked area. Try a nearby point or another stack. |
| "NISAR has no GCOV products over this point" | NISAR has nothing there yet (e.g. open ocean). Try land or a coast. |
| The page looks unstyled | Two `npm.cmd run dev` windows are running in the same folder. Close one and restart the other. |
| `npm` "is not digitally signed" | Use `npm.cmd` instead of `npm` |
| A stack is greyed out | It's pre-calibration (BETA) test data, which DELTA PULSE doesn't analyse |

---

## 7. For the team

- **Refresh the Tonle Sap case study** with newly published dates: `npm.cmd run refresh`
- **Run the tests:** `.\.venv\Scripts\python.exe -m pytest -q`
- **Technical details:** [BACKEND.md](BACKEND.md), [SCIENCE.md](SCIENCE.md), [LIMITATIONS.md](LIMITATIONS.md), [DATA_SOURCES.md](DATA_SOURCES.md)

---

## 8. Setting up the app (for whoever runs it)

DELTA PULSE has two parts that run on your computer: the **app** (what you see) and the **backend** (which fetches NASA data).

1. Open PowerShell and go to the project folder:
   ```powershell
   cd "C:\path\to\Radar-Unit\radar"
   ```
2. **First time only**, install everything:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   npm.cmd install
   ```
3. **First time only**, add a NASA Earthdata token so the backend can read NISAR files:
   - Create a free account at https://urs.earthdata.nasa.gov.
   - Go to **My Profile → Generate Token** and copy it with the copy button.
   - Save it to the private file `.earthdata_token`. This file is never uploaded to GitHub.
     ```powershell
     Set-Content -Path .earthdata_token -Value 'PASTE-TOKEN-HERE' -NoNewline -Encoding ascii
     ```
4. Start the **backend** in one PowerShell window:
   ```powershell
   npm.cmd run api
   ```
5. Start the **app** in a second window:
   ```powershell
   npm.cmd run dev
   ```
6. Open the address it prints (usually http://localhost:3000) in Chrome, Edge or Firefox.

> Use `npm.cmd`, not `npm`, in PowerShell. It avoids a Windows script-security error.
> Run only **one** `npm.cmd run dev` per folder. Two at once break the page's styling.
