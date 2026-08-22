# Google Play — Store Listing Assets

Generated for the Taikan member app. Brand: teal `#0E8C8C`, navy `#0A1628`, mint accent `#5EEAD4`.

## What's here

| Asset | File | Size | Notes |
|-------|------|------|-------|
| Feature graphic | `feature-graphic.jpg` / `.png` | 1024×500 | **Required.** Upload the `.jpg`. |
| Phone screenshots | `phone/phone-*.jpg` (+ `.png`) | 1242×2208 | Required (min 2). Framed + headline. |
| Tablet screenshots | `tablet/tablet-*.jpg` (+ `.png`) | 1600×2560 | Optional but recommended (7"/10" slots). |

Screenshots, in order: 1 Home · 2 Profile (records + membership) · 3 PR Board · 4 Log a PR.

Upload the **`.jpg`** versions (flattened, no alpha — Play's requirement). PNGs are included if you prefer them.

## How they were made

- Captured live from the production app (appletester / "Taikan Demo Gym") on an Android emulator, English UI, light theme.
- Framed in a device mockup on the brand gradient with a headline, rendered to exact Play dimensions.
- Source: real screens (`scratchpad/shots`), frame templates (`scratchpad/frame/gen.py`).

## Data caveat / how to add more

The demo account had only PRs + membership populated (no classes, no coach-assigned program on
any date). To showcase **class booking, QR check-in, and coach workouts**, seed the demo gym
(Taikan Demo Gym) from the web dashboard with classes on current dates + an assigned program,
then re-capture those screens with the same frame template.
