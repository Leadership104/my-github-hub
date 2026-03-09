# UI Design Notes — Glassmorphism, 3D Shadows & Motion Design

**Branch:** `claude/check-code-update-jtt2q`
**Commits:** `5c5b138`, `505b54f`
**Date:** March 2026

---

## Overview

A modern UI refresh has been applied across all primary screens — bringing subtle glassmorphism, layered 3D shadow depth, and minimalist spring-based motion to every interactive element. The goal: feel **refined and intentional** without being heavy or distracting.

---

## Bottom Navigation Bar — `KipitaApp.kt`

| Element | Change |
|---------|--------|
| Nav bar container | Frosted semi-transparent white (88–96% opacity), rounded top corners `20dp` |
| Shadow | `24dp` lift with low-opacity ambient/spot colors — soft float effect |
| Glass shimmer | Horizontal gradient highlight line at top edge |
| Selected tab | Red-tinted vertical gradient pill + `4dp` shadow = raised, selected state |
| Tab animation | Spring scale `1.0 → 1.1×` on active icon (`StiffnessMedium`) |

---

## Auth Screen — `AuthScreen.kt`

### Tab Row (Sign In / Create Account)
- Replaced Material3 `PrimaryTabRow` with a custom floating **pill segmented control**
- Active pill fills with animated white via `animateColorAsState` (`StiffnessMediumLow` spring)
- Selected pill lifts with `4dp` shadow; inactive pill is fully transparent — minimal
- Label color transitions from `KipitaTextSecondary → KipitaRed` via spring

### PrimaryButton
- Vertical red gradient background (subtle top highlight for depth)
- `8dp` shadow with red-tinted spotlight color (`KipitaRed` × 32% alpha)
- Spring press scale `0.97×` using `MutableInteractionSource` — no ripple

### OAuthButton
- `4dp` card shadow on white background
- Spring press scale `0.96×` — same interaction pattern as primary

---

## Places Screen — `PlacesScreen.kt`

### Place Action Buttons (Call / Directions / More Info)
- Shadow color **matches each button's background tint** (e.g. green shadow for Call, blue for Directions)
- `5dp` elevation with `spotColor` at 42% alpha
- Spring press scale `0.94×` — tighter squeeze for smaller buttons

### Sub-Category Chips
- Selected chip gets `4dp` dark navy shadow — visually "lifts" out of the grid
- Unselected chips remain flat (no shadow) — clear hierarchy

### Section Accordions (Restaurants / Entertainment / Shopping)
- `animateDpAsState` transitions shadow `2dp → 10dp` on expand/collapse
- Spring spec (`StiffnessMediumLow`) — smooth, not snappy
- Border color also shifts from `KipitaBorder → dark navy` when expanded

### Place Cards
- `4dp` ambient card shadow added — lifts cards off the page
- Border retained for crispness at low elevations

### Ask Kipita CTA
- `14dp` deep shadow with dark navy spotlight — the boldest element on screen
- Dark-to-darker gradient background (`#1A1A2E → #0D1B2A`)

---

## Home Screen — `HomeScreen.kt`

### Quick Tool Pills (Currency / Maps / Translate / etc.)
- White → `#FAFAFA` vertical gradient — subtle material depth
- `4dp` shadow, spring press scale `0.95×`
- Scale feedback replaces ripple for a quieter, more focused feel

### Home Action Buttons (Kipita AI / Socials)
- Shadow tinted to match each button's background color
- `6dp` elevation with colored spotlight
- Spring press scale `0.96×`

---

## Motion Design Principles

| Principle | How It's Applied |
|-----------|-----------------|
| **Spring physics** | All animations use `Spring.StiffnessMedium` or `StiffnessMediumLow` — no linear/tween curves |
| **Scale as feedback** | Press = subtle scale squeeze (`0.94–0.97×`). Ripple removed. |
| **Color transitions** | Tab labels and pill backgrounds use `animateColorAsState` with spring spec |
| **Layered depth** | Nav bar (24dp) > CTA buttons (14dp) > action buttons (5–6dp) > cards (4dp) > chips (4dp selected) |
| **Entrance stagger** | `AnimatedVisibility` + `slideInVertically` with staggered `tween` delays preserved on all screens |
| **Shadow tinting** | Shadows use each surface's own color at low alpha — avoids generic grey shadows |

---

## Files Changed

```
app/src/main/java/com/kipita/presentation/main/KipitaApp.kt
app/src/main/java/com/kipita/presentation/auth/AuthScreen.kt
app/src/main/java/com/kipita/presentation/places/PlacesScreen.kt
app/src/main/java/com/kipita/presentation/home/HomeScreen.kt
```
