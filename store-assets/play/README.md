# Google Play — Store Listing Assets

Generated for the Taikan member app. Brand kit **v3.1**: teal `#0E8C8C` / `#2AB8B8`,
violet `#7A4BE0` / `#9B6BFF`, band `#07202B`, mint `#B0E5C4` (PR/streak only).

## What's here

| Asset | File | Size | Source | Notes |
|-------|------|------|--------|-------|
| Feature graphic | `feature-graphic.jpg` / `.png` | 1024×500 | **generated** | **Required.** Upload the `.jpg`. |
| Play icon | `icon-512.png` | 512×512 | **generated** | **Required.** Console field, not a build input. |
| App Store icon | `../appstore/icon-1024.png` | 1024×1024 | **generated** | No alpha, square — the OS masks it. |
| Phone screenshots | `phone/phone-*.jpg` (+ `.png`) | 1242×2208 | captured | Required (min 2). Framed + headline. |
| Tablet screenshots | `tablet/tablet-*.jpg` (+ `.png`) | 1600×2560 | captured | Optional but recommended (7"/10" slots). |

> ⚠️ **The screenshots still carry FitKit branding.** They were captured from a
> running app, so the brand generator can't touch them — they need re-capturing
> against a Taikan build before the next store submission.

Screenshots, in order: 1 Home · 2 Profile (records + membership) · 3 PR Board · 4 Log a PR.

Upload the **`.jpg`** versions (flattened, no alpha — Play's requirement). PNGs are included if you prefer them.

## How they were made

**Generated assets** come from the brand generator in the main repo and must never
be hand-edited:

```bash
cd ../taikan && TAIKAN_MOBILE_ROOT=/path/to/taikan-mobile pnpm brand:assets:all
```

The feature graphic follows brand kit §08 — mark at 164px, Rubik 600 wordmark,
Assistant tagline and subhead, all outlined to paths so the raster doesn't depend
on a font being installed.

**Captured assets** (screenshots):

- Captured live from the production app (appletester / "Taikan Demo Gym") on an Android emulator, English UI, light theme.
- Framed in a device mockup on the brand gradient with a headline, rendered to exact Play dimensions.
- Source: real screens (`scratchpad/shots`), frame templates (`scratchpad/frame/gen.py`).

## Data caveat / how to add more

The demo account had only PRs + membership populated (no classes, no coach-assigned program on
any date). To showcase **class booking, QR check-in, and coach workouts**, seed the demo gym
(Taikan Demo Gym) from the web dashboard with classes on current dates + an assigned program,
then re-capture those screens with the same frame template.
