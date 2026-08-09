# Milo Design System

This file is the visual source of truth for Milo. Page-specific files under `pages/` may override it only when the deviation is intentional and documented.

## Product character

Milo is a private dating-message coach for adults. It should feel calm, human, discreet and editorial—not like a generic AI dashboard, pickup-artist product, social network or children’s app.

Preserve:

- The original friendly cat mascot and Lucide outline icons.
- Editorial Fraunces headings with clean Geist body copy.
- Indigo as the trusted product color, with pink used sparingly for warmth.
- Clear privacy, consent and user-control language near every sensitive action.
- Real product demonstrations without fabricated ratings, testimonials or app-store claims.

## Tokens

The implemented semantic tokens in `src/app/globals.css` are authoritative.

| Role | Light | Dark | Usage |
|---|---:|---:|---|
| Background | `#FBFAF7` | `#101018` | Warm page canvas |
| Foreground | `#1D1D35` | `#F7F4EE` | Primary text |
| Surface | `#FFFFFF` | `#191924` | Cards and controls |
| Muted text | `#66667B` | `#B0ADBB` | Secondary copy |
| Brand | `#3F50DC` | `#7F8CFF` | Links, icons and emphasis |
| Brand fill | `#3F50DC` | `#4050C8` | Primary CTA backgrounds |
| Accent | `#F4A7C1` | `#F4A7C1` | Warm decorative detail only |
| Focus | `#2639B8` | `#C2C8FF` | Opaque keyboard focus ring |

Never use a theme-dependent light brand token as text on a white button. Use `--brand-on-light` for that pair. Every normal-text pair must meet WCAG AA 4.5:1.

## Typography and hierarchy

- Display/headings: Fraunces, semibold, compact tracking.
- Body and controls: Geist, 16px minimum for mobile inputs/body.
- Body line height: 1.5–1.75; desktop text measure: 60–75 characters.
- Use one clear `h1` per screen and sequential heading levels.
- Avoid language implying mind-reading, personality profiling or guaranteed romantic outcomes.

## Components

- Primary buttons: full indigo fill, white text, pill shape, minimum 48px height.
- Secondary buttons: surface or transparent background with a visible border; minimum 44px target.
- Icon-only controls: minimum 44×44px with an accessible name.
- Cards: 24–32px radius for major product surfaces; consistent subtle border and restrained shadow.
- Inputs: visible labels, 16px text, minimum 52px height, nearby helper/error text and opaque focus ring.
- Feedback: loading state within 100ms, disabled during submission, status/error announced without stealing focus.

## Layout

- Mobile first at 360–375px; then 768px, 1024px and 1440px.
- Use the existing 4/8px spacing rhythm and adaptive page gutters.
- Respect safe areas for fixed mobile navigation and CTA bars.
- Keep the core action above the fold, especially sign-in and screenshot analysis.
- Do not create horizontal scrolling or nested primary scroll regions.

## Motion

- 150–300ms transitions using opacity/transform only.
- Motion must explain state or cause/effect; no decorative infinite movement except a real loading state.
- Respect `prefers-reduced-motion` and keep controls usable while transitions run.

## Acquisition pattern

Milo is a mobile-first web SaaS, not a native app-store product. Landing order:

1. Honest outcome and interactive product preview.
2. Three-step workflow.
3. Tone examples.
4. Privacy and control guarantees.
5. Transparent free/paid allowance.
6. Honest FAQ and final CTA.

Do not add fake social proof, download badges, manipulative scarcity, partner scoring or claims that Milo knows another person’s feelings.

## Pre-delivery gate

- WCAG AA contrast and visible focus in light and dark themes.
- Keyboard order and form labels verified.
- All touch targets at least 44×44px.
- 360/375px portrait and phone landscape checked with no overflow.
- Reduced-motion behavior checked.
- No sensitive screenshots, OCR text or replies in logs/analytics.
- Demo state is causally coherent: a visible fictional conversation precedes its fictional replies.
