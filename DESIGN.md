# Design Direction: Xenn for all

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Product Identity
Xenn for all is a private, client-side browser workstation for PDF and image manipulation. It runs entirely on the visitor's machine via WebAssembly and client-side JavaScript. There are no user accounts, no tracking cookies, no server uploads, and no subscription paywalls.

## Personality & Voice
- **Direct and Honest:** States what each tool does without marketing inflation or pseudo-magical metaphors.
- **Calm and Tactile:** Evokes a clean physical desk or drafting table with natural paper tones and forest accents.
- **Crafted for Utility:** Every button, preview, and input is functional. No dead links, no placeholder icons, and no decorative sparkle tropes.

## Color System
Limit active palette to core neutrals, primary forest ink, and focused functional accents:
- **Light Theme Background:** `#FAF9F5` (warm cream/paper)
- **Light Surface / Cards:** `#FFFFFF` with borders `#DCE3D6`
- **Text Main:** `#1A2B21` (Contrast > 12:1 against light background)
- **Text Secondary / Muted:** `#3D5245` (Contrast > 6.2:1 against light background, well above WCAG AA 4.5:1)
- **Primary Brand / Action:** `#284A35` (Deep Forest Green, text white passes WCAG AAA)
- **Primary Hover:** `#355E44`
- **Dark Theme Background:** `#131915` (Deep slate moss)
- **Dark Surface / Cards:** `#1A231D` with borders `#2B382F`
- **Dark Text Main:** `#F0F4EE`
- **Dark Text Secondary:** `#A7B8AC`
- **Focus Ring:** `#2E7A4A` (3px outline with offset)

## Typography
- **Headings & Brand:** `Manrope` (weights 600, 700, 800)
- **Body & Controls:** `DM Sans` (weights 400, 500, 600)
- No artificial monospace decorative blocks or extreme letter-spaced uppercase filler.

## Levers & Affordances
- **One focal point per screen:** In the hero, a tangible demonstration of client-side file privacy and direct tool actions.
- **Structural spacing:** Generous whitespace defining sections rather than arbitrary decorative borders.
- **Functional Completeness:** Every interactive control has accessible hover, active, and focus-visible states. Touch targets meet 44px minimum. Full keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Escape`).
- **No AI Slop Tells:** No em dashes, no "magic" buzzwords, no sparkles, no fake terminal windows, no floating orbits, and no unsourced statistics.
