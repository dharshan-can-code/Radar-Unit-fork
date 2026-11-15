// Self-hosted typefaces, so builds and local development never depend on Google Fonts.
//   Space Grotesk  headings
//   IBM Plex Sans  interface text
//   IBM Plex Mono  dates, coordinates and measurements
// The .woff2 files in ./fonts are the Google Fonts subsets of each family (SIL Open Font
// License 1.1; the licence texts sit next to them). Each subset is its own @font-face with
// the unicode-range Google publishes, so the browser downloads latin-ext, Vietnamese or
// Greek only when a page actually shows such a character (an accented place name, a "Δ").
import localFont from "next/font/local";

const grotesk = localFont({
  src: "./fonts/SpaceGrotesk-latin.woff2",
  weight: "300 700",
  variable: "--font-grotesk",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+00??, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const groteskExt = localFont({
  src: "./fonts/SpaceGrotesk-latin-ext.woff2",
  weight: "300 700",
  variable: "--font-grotesk-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const groteskVi = localFont({
  src: "./fonts/SpaceGrotesk-vietnamese.woff2",
  weight: "300 700",
  variable: "--font-grotesk-vi",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const plexSans = localFont({
  src: "./fonts/IBMPlexSans-latin.woff2",
  weight: "400 600",
  variable: "--font-plex-sans",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+00??, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const plexSansExt = localFont({
  src: "./fonts/IBMPlexSans-latin-ext.woff2",
  weight: "400 600",
  variable: "--font-plex-sans-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const plexSansVi = localFont({
  src: "./fonts/IBMPlexSans-vietnamese.woff2",
  weight: "400 600",
  variable: "--font-plex-sans-vi",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

const plexSansGreek = localFont({
  src: "./fonts/IBMPlexSans-greek.woff2",
  weight: "400 600",
  variable: "--font-plex-sans-greek",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF" }],
});

const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+00??, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

const plexMonoExt = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500-latin-ext.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

const plexMonoVi = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400-vietnamese.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500-vietnamese.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono-vi",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

/** Class names that define every font CSS variable; put on <body>. */
export const fontVariables = [grotesk, groteskExt, groteskVi, plexSans, plexSansExt, plexSansVi, plexSansGreek, plexMono, plexMonoExt, plexMonoVi].map((f) => f.variable).join(" ");
