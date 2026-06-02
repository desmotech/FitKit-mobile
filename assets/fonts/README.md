# FitKit fonts — "Whiteboard" type system

Bundled, static, per-weight `.ttf` faces. Registered in `app/_layout.tsx`
via `useFonts` and referenced through `src/lib/type.ts` (the typed `font`
map) and the NativeWind `font-*` utilities in `tailwind.config.js`.

Each weight is its own family name because RN/Android does not reliably
match `fontWeight` within a single custom family — so we map weight → family
explicitly rather than relying on `fontWeight`.

| Family (RN name)              | File                      | Role                |
| ----------------------------- | ------------------------- | ------------------- |
| `ClashGrotesk` (alias = Bold) | ClashGrotesk-Bold.ttf     | Display / headlines |
| `ClashGrotesk-Regular`        | ClashGrotesk-Regular.ttf  | Display             |
| `ClashGrotesk-Medium`         | ClashGrotesk-Medium.ttf   | Display             |
| `ClashGrotesk-Semibold`       | ClashGrotesk-Semibold.ttf | Display             |
| `Manrope` (alias = Regular)   | Manrope-Regular.ttf       | Body / UI           |
| `Manrope-Medium`              | Manrope-Medium.ttf        | Body / UI           |
| `Manrope-SemiBold`            | Manrope-SemiBold.ttf      | Body / UI           |
| `Manrope-Bold`                | Manrope-Bold.ttf          | Body / UI           |
| `Manrope-ExtraBold`           | Manrope-ExtraBold.ttf     | Body / UI           |
| `DMMono` (alias = Regular)    | DMMono-Regular.ttf        | Numerals / labels   |
| `DMMono-Medium`               | DMMono-Medium.ttf         | Numerals / labels   |
| `Alef`                        | Alef-Regular.ttf          | Hebrew body         |
| `Alef-Bold`                   | Alef-Bold.ttf             | Hebrew body         |
| `Rubik-Medium`                | Rubik-Medium.ttf          | Hebrew display      |
| `Rubik-Bold`                  | Rubik-Bold.ttf            | Hebrew display      |
| `Rubik-Black`                 | Rubik-Black.ttf           | Hebrew display      |

## Licensing (all free for commercial use)

- **Clash Grotesk** — Fontshare ITF Free Font License. Sourced from the
  `Mudrank/Clash-Grotesk` GitHub mirror.
- **Manrope, DM Mono, Alef, Rubik** — SIL Open Font License 1.1 (Google Fonts).

## Hebrew note

The originally-requested **Abraham** face is personal-use-only (not free to
ship), so Hebrew display uses **Rubik** (titles/subtitles) + **Alef** (body).
To switch to a licensed Abraham later, drop its `.ttf` files here, register
them in `app/_layout.tsx`, and repoint `hebrewDisplay*` in `src/lib/type.ts`.
