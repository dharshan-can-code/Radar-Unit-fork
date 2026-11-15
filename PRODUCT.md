# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Confirmed by the team on 2026-11-15: the app must be useful to two audiences at once.

- Regular people: a NASA Space Apps judge or a member of the public with no radar background, who gives the site a few minutes. They need to understand what the app is for and what each result means without being told.
- Professionals: water and wetland managers, and people who work with radar or remote sensing. They need the exact quantity, unit, threshold and provenance behind each result, and the data to download.

Students and teachers are a further audience.

## Product Purpose

DELTA PULSE shows where water is spreading under cloud and tree cover, using real NASA-ISRO NISAR L-band radar passes. It turns each comparison of two passes into a plain answer (what changed, by how much, and how sure we can be) and keeps every statement labelled as observed, calculated, interpreted or unconfirmed. Success: a first-time visitor can say what the app does and read one result correctly within a few minutes, then try a place of their own.

## Positioning

It reads real NISAR GCOV radar files for any place on Earth and explains them in plain words, with the uncertainty stated, instead of showing an unlabelled flood map.

## Operating Context

- A first visit follows one path: see one explained result (Tonle Sap, Cambodia), then choose a place, then read the map and the evidence for it.
- Place search, the archive listing and the newest-acquisitions globe work in the browser. Analysing a new place needs the Python backend (`radar/backend`), which reads NASA files with an Earthdata login.
- The public site is a static front end on Vercel; the backend runs locally or on a separate Python host.

## Capabilities and Constraints

- Front end: Next.js 15, React 19, Tailwind 4, MapLibre, Recharts. Fonts are self-hosted.
- Screening thresholds are uncalibrated starting values. Nothing is labelled as confirmed flooding.
- The "water under trees" radar signature is also produced by buildings; results for towns must say so.
- No new packages without asking the team.

## Brand Commitments

- Name: DELTA PULSE, by Team RADAR UNIT.
- The four evidence labels (OBSERVED, CALCULATED, INTERPRETED, UNCONFIRMED) appear on every claim.
- The look is a survey sheet (chosen by the team on 2026-11-15, replacing the violet theme): map-paper ground, hydrography blue for actions, contour lines behind headings, in light and dark. Cyan and amber are reserved for what the data shows (open water, water under vegetation).

## Evidence on Hand

- Tonle Sap case study: 10 NISAR passes, June to October 2026, with independent checks (Landsat water history, a river-flow model, weather records) in `radar/public/data`.
- Three saved examples: Manaus, Sundarbans, Okavango.
- No ground measurements exist; none may be implied.

## Product Principles

1. Say what it means before showing how it was measured, and put the exact term and number beside the plain words, never instead of them.
2. One path for a first visit; depth is available but never in the way.
3. Never claim more certainty than the evidence gives.
4. The same words for the same thing on every page.
