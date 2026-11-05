# Design Direction: Xenn for all

Dial: ENERGY 2 / RHYTHM 3 / MOTION 1

## Product Identity
Xenn for all is a private, client-side browser workstation for PDF and image manipulation. It runs entirely on the visitor's machine via WebAssembly and client-side JavaScript. There are no user accounts, no tracking cookies, no server uploads, and no subscription paywalls.

## Personality & Voice
- **Direct and Honest:** States what each tool does without marketing inflation or pseudo-magical metaphors.
- **Calm, Tactile & Expansive:** Evokes a spacious physical drafting desk. The layout expands gracefully across wide modern displays (1440px–1920px+) without leaving vast empty voids on the sides.
- **Crafted for Utility:** Every button, preview, and input is functional. The hero serves as a live, functional drop hub that detects file types and offers instant actions.

## Viewport & Layout Architecture (R-03, R-05)
- **Container Scale:** Wide fluid container with `max-width: 1640px` and responsive gutters `clamp(20px, 3.5vw, 56px)`, preventing narrow center clustering on modern widescreen monitors.
- **Hero Hub:** Two balanced, high-density columns:
  - Left: Confident typography, explicit client-side privacy metrics (11 tools, 100 MB max, 0 bytes uploaded, AGPL-3.0).
  - Right: Interactive File Drop Workstation with file-type auto-detection and direct tool launching.
- **Tool Directory:** Responsive fluid grid with `repeat(auto-fill, minmax(280px, 1fr))` supporting 4–5 cards abreast on desktop.
- **Architecture & Privacy Comparison:** Full-width 4-pillar architectural proof grid plus a transparent feature comparison matrix (Cloud vs In-Browser).

## Color System
- **Light Theme Background:** `#FAF9F5` (warm cream/paper)
- **Light Surface / Cards:** `#FFFFFF` with borders `#DCE3D6`
- **Text Main:** `#1A2D22` (Contrast > 12:1 against light background)
- **Text Secondary / Muted:** `#364C3E` (Contrast > 7.6:1 against light background)
- **Primary Brand / Action:** `#254531` (Deep Forest Green)
- **Primary Hover:** `#335C43`
- **Dark Theme Background:** `#131915` (Deep slate moss)
- **Dark Surface / Cards:** `#1B241E` with borders `#2C3C31`
- **Dark Text Main:** `#F2F6F1` (Contrast > 15:1 against dark background)
- **Dark Text Secondary:** `#B2C5B7` (Contrast > 8:1 against dark background)
- **Focus Ring:** `#2E6D47` (Light) / `#5EA778` (Dark)

## Typography
- **Headings & Brand:** `Manrope` (weights 600, 700, 800)
- **Body & Controls:** `DM Sans` (weights 400, 500, 600)
- No artificial monospace decorative blocks or extreme letter-spaced uppercase filler.
