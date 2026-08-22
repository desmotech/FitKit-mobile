# Taikan fonts — "Whiteboard" type system

Bundled, static, per-weight `.ttf` faces. Registered in `app/_layout.tsx`
via `useFonts` and referenced through `src/lib/type.ts` (the typed `font`
map) and the NativeWind `font-*` utilities in `tailwind.config.js`.

Each weight is its own family name because RN/Android does not reliably
match `fontWeight` within a single custom family — so we map weight → family
explicitly rather than relying on `fontWeight`.

| Family (RN name)               | File                    | Role                  |
| ------------------------------ | ----------------------- | --------------------- |
| `Rubik-Bold` (display alias)   | Rubik-Bold.ttf          | Display / headlines   |
| `Rubik-Regular`                | Rubik-Regular.ttf       | Display               |
| `Rubik-Medium`                 | Rubik-Medium.ttf        | Display               |
| `Rubik-SemiBold`               | Rubik-SemiBold.ttf      | Display               |
| `Rubik-Black`                  | Rubik-Black.ttf         | Display (hero)        |
| `Assistant-Regular` (body)     | Assistant-Regular.ttf   | Body / UI (he + en)   |
| `Assistant-Medium`             | Assistant-Medium.ttf    | Body / UI             |
| `Assistant-SemiBold`           | Assistant-SemiBold.ttf  | Body / UI + eyebrows  |
| `Assistant-Bold`               | Assistant-Bold.ttf      | Body / UI             |
| `Assistant-ExtraBold`          | Assistant-ExtraBold.ttf | Body / UI             |
| `DMMono` (alias = Regular)     | DMMono-Regular.ttf      | Numerals only         |
| `DMMono-Medium`                | DMMono-Medium.ttf       | Numerals only         |
| `Manrope` (alias = Regular)    | Manrope-Regular.ttf     | Body — Russian only   |
| `Manrope-Medium`               | Manrope-Medium.ttf      | Body — Russian only   |
| `Manrope-SemiBold`             | Manrope-SemiBold.ttf    | Body — Russian only   |
| `Manrope-Bold`                 | Manrope-Bold.ttf        | Body — Russian only   |
| `Manrope-ExtraBold`            | Manrope-ExtraBold.ttf   | Body — Russian only   |

## Licensing

All SIL Open Font License 1.1, free for commercial use (Google Fonts):
**Rubik** (Hebrew + Latin + Cyrillic) · **Assistant** (Hebrew + Latin) ·
**DM Mono** · **Manrope**.

## Roles

The system is **bilingual by design** — both Rubik and Assistant carry Hebrew
*and* Latin, so mixed-script strings ("Pull Up · 20 דקות") render in one voice
instead of tofu-ing in whichever script a single-script font lacks.

- **Display** — **Rubik** for every language (Hebrew, English, Russian). One
  geometric face; weight carries hierarchy.
- **Body** — **Assistant** for Hebrew + English. Russian uses **Manrope**
  (Assistant has no Cyrillic), routed per-language in `bodyFamily()`
  (`src/lib/type.ts`).
- **Numerals** — DM Mono, for *pure* digits only. Never wrap Hebrew in it
  (no Hebrew glyphs); use `eyebrow()` for labels.

The previous Clash Grotesk / Abraham / Alef experiment has been removed.
