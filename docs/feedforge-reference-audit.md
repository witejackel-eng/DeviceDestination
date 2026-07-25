# FeedForge reference audit

Reference: <https://feed-forge.integritas.agency/index.html>
Audited: 2026-07-25, live site, in-browser computed styles + stylesheet/script inspection.
Widths sampled: 1920×1080, 1440×900, 1280×720, 768×1024, 375×812.

This document records **measured** values. It is an interaction-grammar reference only.
No FeedForge asset, image, copy, testimonial, logo or source file is copied into
DeviceDestination. Everything below is re-implemented from first principles.

---

## 1. Typography

### Font identification (positive, not guessed)

`document.fonts` reports the loaded families directly:

| Family | Weights loaded | Role |
| --- | --- | --- |
| **Plus Jakarta Sans** | 400, 500, 600, 700, 800 (200/300 declared, unloaded) | All UI and display type |
| Over the Rainbow | 400 | Decorative handwriting accent only |
| swiper-icons | 400 | Slider glyphs (unloaded) |

Plus Jakarta Sans is licensed under the **SIL Open Font License 1.1** and is
served from Google Fonts. It therefore satisfies all three of the brief's
conditions (positively identified, legally licensable, obtainable from a
legitimate source) and can be used directly via `next/font/google` — no font
file is taken from the reference site.

Body default: `Plus Jakarta Sans`, 16px, colour `#000`, background `#fff`.

### Measured type scale

| Element | ≥1025px | ≤1024px | Weight | Line-height ratio |
| --- | --- | --- | --- | --- |
| H1 | 82px / 123px | 40px / 60px | 800 | **1.50** |
| H2 | 42px / 63px | 32px / 48px | 800 | **1.50** |
| Supporting paragraph | 17px | 17px | 400–500 | ~1.6 |

Letter-spacing is `normal` throughout — the compactness reads as tight because
Plus Jakarta Sans is a naturally narrow grotesk at weight 800, not because of
negative tracking. Some blocks use `font-stretch: semi-condensed`.

**The single most transferable typographic decision:** a constant 1.5
line-height at every size, including the 82px hero. It is unusually airy for
display type and it exists because each line is wrapped in an overflow-hidden
mask that needs vertical room for the reveal (see §4).

`text-transform` is `none` everywhere — sentence case, no uppercase headings.

### Headline line breaks

The H1 DOM contains **no whitespace text nodes**. Every word is an inline-block
`<span>` inside a per-line `<div data-line-idx="N">`. Line breaks are therefore
computed and re-wrapped by script, not authored. 28 line divs exist across 4
split headings (`data-split=4`, `data-total-lines=4`).

---

## 2. Layout, container, spacing

```css
.container {
  margin-inline: auto;
  width: 1300px;
  max-width: 100%;
  padding-left: 64px;
  padding-right: 64px;
}
```

- Max content width: **1172px** (1300 − 2×64).
- Gutters collapse to **16px** at ≤1024px.
- No horizontal overflow at any width sampled (`scrollWidth == innerWidth`).

### Breakpoints

Only three media queries drive the whole site:

| Query | Meaning |
| --- | --- |
| `(min-width:1025px)` | desktop |
| `(min-width:768px) and (max-width:1024px)` | tablet |
| `(min-width:0px) and (max-width:767px)` | phone |

Tailwind's `mobile:` variant maps to **max-width 1024px**. Tablet and phone
share nearly all type and spacing values — it is effectively a two-tier system.

### Header

| | ≥1025px | ≤1024px |
| --- | --- | --- |
| Height | 89px | 58px |
| Padding-top | 33px | 16px |
| Position | `absolute; top:0; z-30` | same |
| Background | transparent | transparent |
| Backdrop-filter | none | none |
| Border | none | none |

Notable: the reference header is **absolute, not sticky**, and never acquires a
blurred/bordered scrolled state. It simply scrolls away. This is an agency-site
affordance and is the one header behaviour DeviceDestination should **not**
copy — a shop needs a persistent cart and search.

### Section rhythm

Vertical padding is a small, repeated set: **72px** (most), **100px** (feature
intro), **68px**; at ≤1024px these drop to **56px / 72px**. Section backgrounds
alternate transparent → `#180703` (dark) → `#f3f3f3` (light grey) → gradient.

---

## 3. Surfaces: radii, shadows, colour

### Border-radius census (frequency across live DOM)

| Radius | Count | Typical use |
| --- | --- | --- |
| 9px | 18 | small controls, chips |
| 14px | 17 | buttons, inputs |
| 9999px | 11 | pills, avatars |
| 24px | 6 | large media cards |
| 6px / 4px | 7 | tags, badges |
| 16px | 1 | one-off |

A clean scale: **4 · 6 · 9 · 14 · 16 · 24 · full**.

### Shadows

**There are effectively none.** The only `box-shadow` found is Tailwind's
zero-value reset. Depth is carried entirely by border, background contrast and
spacing. This directly validates the brief's "use shadows sparingly / prefer
border, spacing and typography".

### Palette (from compiled utilities)

| Token | Value | Role |
| --- | --- | --- |
| `nb` | `#170400` | near-black text (warm) |
| `nbrown` | `#180703` | dark section surface |
| `nw` | `#fafafa` | near-white on dark |
| `stuff_bg` | `#31221e` | warm brown card / border |
| — | `#f3f3f3` | light grey section |
| `round_bg` / `round_text` | `#fff96c` / `#604b01` | yellow accent + its text |
| `bg_purple` | `#9893f4` | secondary accent |
| — | `#8cc9fa` | blue accent |
| — | `rgba(23,4,0,0.05)` | hairline borders / tints |

Gradients are restrained and all vertical:
`linear-gradient(180deg,#31221e,#2b1915)`, `linear-gradient(180deg,#180703,#18070300)`,
plus edge-fade masks `linear-gradient(90deg,#00000080,#0000)` for the rail.

**Transferable principle:** the dark surface is a warm near-black
(`#180703`), never `#000`. DeviceDestination's existing `--ink: #171513` is
already the same idea and needs no change.

---

## 4. Motion system

No GSAP. The stack is **Lenis** (smooth scroll) + a bespoke `main.js` +
Swiper (present but unused on this page). All animation is CSS transitions
driven by JS, plus IntersectionObserver.

### Measured easings

| Curve | Use |
| --- | --- |
| `cubic-bezier(0.23, 1, 0.32, 1)` | easeOutQuint — **primary** transform curve |
| `cubic-bezier(0.16, 1, 0.3, 1)` | easeOutExpo — entrances |
| `cubic-bezier(0.32, 0.72, 0, 1)` | sharp in-out — panels/menu |
| `cubic-bezier(0.4, 0.4, 0.0, 1)` | standard |
| `cubic-bezier(0.34, 2.8, 0.64, 1)` | overshoot — used very sparingly |

### Measured durations and delays

| Interaction | Value |
| --- | --- |
| Line reveal | `transform 0.55s cubic-bezier(.23,1,.32,1)` + `opacity 0.4s ease`, shared delay |
| Header children entrance | `opacity 0.45s ease`, stagger **100ms** |
| Page-entrance constants | initial delay **200ms**, **600ms**, **480ms**, stagger **0.07s (70ms)** |
| Micro-interactions | `0.18s ease-in`, `0.3s ease` |
| Nav indicator morph | `left 0.35s ease, width 0.35s ease` |
| Slow fades | `0.65s ease` |
| Lenis inertia | `duration: 1.6` |

These map almost exactly onto the brief's targets (micro 160–240ms, content
400–650ms, hero 600–900ms, stagger 50–90ms). No change of target needed.

### Line-reveal technique

```
<div style="overflow:hidden; padding-bottom:.25em; margin-bottom:-.25em">
  <div data-line-idx="0" style="transform: translateY(calc(100% + .25em)) translateZ(0)">
    <span style="display:inline-block; vertical-align:middle">We</span>
```

Three details worth reproducing:

1. The `padding-bottom: .25em` + `margin-bottom: -.25em` pair gives descenders
   room inside the mask without changing layout height.
2. `translateZ(0)` promotes the layer; `will-change` is set **only for the
   duration** and reset to `auto` afterwards, with the parent's `overflow`
   restored to `visible` after `(delay + 0.55s) + 100ms`. This avoids permanent
   compositor pressure — a common failure in agency clones.
3. Entrance waits on `Promise.all([document.fonts.ready, 200ms])` before
   playing, so a late webfont cannot cause the reveal to mis-measure lines.

### Scroll-triggered reveals

`IntersectionObserver` on `h1, h2, h3, [data-heading]`, with
`rootMargin: "0px 0px -30px 0px"`, `threshold: 0.1`, and `unobserve()` after
firing — strictly **once**, never replayed on scroll-back.

### Sticky horizontal rail

`.slider-wrapper` is the signature composition:

- `position: sticky`, `top: 140px` (desktop) / `292px` (tablet) / `186px` (phone)
- `overflow: hidden; width: 100vw`, left padding `calc((100vw - container)/2)`
  so the first card aligns to the text column while the track bleeds full-width
- Inner track: `width: 5000px; display:flex; gap: 24px`
- Cards: **312 × 440px, ratio 0.71 (≈5:7 portrait), radius 24px**
- Pinned for roughly 1800px of scroll while the track translates horizontally
- Horizontal translation is driven by Lenis's scroll callback, not `scroll`
  events — `window.scrollTo()` does not move it, confirming rAF-driven updates
  rather than per-event React state.

### Mobile menu

`.mobile-menu` is `position: fixed; inset: 0; height: 100dvh; z-index: 40;
padding: 16px 16px 0` — a full-bleed inset panel, `transition: background 0.55s`.
Uses `dvh`, not `vh`, so mobile browser chrome does not clip it.

### Reduced motion

`main.js` early-returns from the split/reveal initialiser when
`matchMedia("(prefers-reduced-motion: reduce)")` matches. Headings are then
never split and never transformed — content renders in its final state. This is
the correct pattern: **skip the animation system entirely rather than
fast-forwarding it.**

---

## 5. What DeviceDestination should and should not take

### Take

- Plus Jakarta Sans (OFL) at weight 800 for display, 400–600 for text
- Constant 1.5 line-height on masked display lines
- 1300px container with 64px → 16px gutters
- 72/100px section rhythm, halved on mobile
- Radius scale 4/6/9/14/16/24/full; **near-zero shadow**
- Warm near-black dark sections, never pure black
- easeOutQuint `(0.23,1,0.32,1)` as the primary transform curve
- 0.55s line reveal, 70–100ms stagger, 200ms font-gated start
- IntersectionObserver reveal that fires once and cleans up `will-change`
- Sticky full-bleed rail with container-aligned left padding
- `dvh`-based mobile panel
- Reduced motion = skip the system, not shorten it

### Do not take

- Logo, brand, wordmark, imagery, video, testimonials, copy, illustrations
- The absolute non-sticky header (a shop needs persistent cart + search)
- Lenis smooth-scroll hijacking — it fights native scrolling on a catalogue and
  adds a dependency for no commercial benefit
- A 4194px pinned hero — it would push all commerce far below the fold
- Sticky horizontal rails on phones (the reference keeps them; a shop should not)
- 5000px fixed-width tracks (not responsive; use measured widths)

### Accessibility observations on the reference

- 4 of 41 interactive elements are under the 44px minimum touch height at 375px.
- No skip link.
- Reduced motion is handled well.

DeviceDestination must beat the reference on all three.
