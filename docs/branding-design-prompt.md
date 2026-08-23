# Prompt — Taikan logo + brand kit

Paste the block below into Claude Design. Two things to settle first:

1. **The name story.** The brief defaults to 体幹 *taikan* — Japanese for the
   body's trunk / core. If the name came from somewhere else, edit that
   paragraph; it's the input that most changes what comes back.
2. **Evolve or replace.** The brief retires the ribbon-globe outright. Say so
   there if you'd rather it were evolved.

A longer version — adding misuse, palette, and type-specimen artboards — is at
`git show ef13dcf:docs/branding-design-prompt.md`. Those are brand-manual
sheets; they're worth generating once a mark exists, not before.

---

You are a brand designer building the identity for a product that has just
been renamed. Produce a **brand kit as a multi-artboard design canvas**.

## The company

**Taikan** is a B2B SaaS platform for gyms, CrossFit boxes, studios, and
independent coaches — memberships, scheduling, programming, payments, member
comms. Two audiences, and the identity has to hold both: **owners and coaches**
running a business on the web dashboard, who want a serious operational tool
rather than a wellness app; and **members** on the mobile app, opening it in a
loud gym between sets to check programming, scan in at the door, or log a PR.

It was called FitKit until last week. New bundle id, new domain, new store
listing — the identity has to earn the new name, not dress up the old one.

**The name.** 体幹 — *taikan* — is Japanese for the trunk of the body: the
core, the load-bearing centre everything else moves around. Athletes train it
first because nothing else holds without it. That's the brand's argument for
itself. Build on that idea — but no kanji in the logo, and nothing that reads
as a martial-arts dojo. The reference is structural, not decorative.

**Positioning:** structural · disciplined · calm under load · earned, not
hyped. **Not:** hustle-culture, neon, gamified, wellness, medical.

## Fixed inputs — design into these, don't redesign them

The palette and type shipped with the rebrand and are live in the web app, the
marketing site, and mobile.

**Ocean light** (primary ground): `bg #F6F8FA` · `ink #0D1B2A` ·
`border #DCE3EA` · **`teal #0E8C8C`** (brand fill) · **`mint #2E7A4D`**
(highlight — today, PRs, streaks)
**Ocean dark / "band"**: `bg #07202B` · `ink #EAF2F4` · **`teal #2AB8B8`** ·
**`mint #B0E5C4`**

Teal is the brand, mint is the one accent, navy is the ink. No fourth colour.

Type: **Rubik** for display (Latin + Hebrew + Cyrillic), **Assistant** for body
(Latin + Hebrew; Russian body falls back to **Manrope**, as Assistant has no
Cyrillic). Draw the wordmark from Rubik — customised and tightened where it
earns it — so it sits in the same family as the product UI. Note the weight you
started from.

**The mark being retired:** a 3D ribbon-globe with an ECG line through it, in
teal-to-navy gradients. Its four failures are the constraints on its
replacement: it exists only as a 1024px raster; the ribbons close up below
~32px; the gradients have no one-colour reduction; and globe-plus-heartbeat
says telemedicine, not strength training.

## Hard constraints

1. **Reads at 20px.** It's a tab-bar icon, a notification icon, and a favicon
   before it's anything else. Design it small first, then scale up.
2. **Flat vector.** No gradients in the primary mark, no bevels, no 3D, no
   shadows. The one-colour version must be the *same* mark, not a reduction.
3. **Survives one colour** — solid teal, solid navy, white knocked out of the
   band, pure black. Counters stay open at 8mm wide on a door decal.
4. **Non-directional.** The app ships English, **Hebrew (RTL)**, and Russian.
   "Taikan" stays Latin in every locale, but lockups mirror — so nothing that
   reads as an arrow or a swoosh, which reverses meaning when flipped.
5. **Android adaptive icon** — foreground inside the 66/108 safe circle, intact
   under circle, squircle, and rounded-square masks.
6. **iOS icon** — 1024×1024, no alpha, no corner rounding of your own.

## Artboards

1. **The mark** — the symbol alone on light, plus its construction: the grid,
   circles, or angles it's built from, with ratios called out. A logo that
   can't be reconstructed from a rule isn't finished.
2. **Size ladder** — 512 / 128 / 64 / 32 / 24 / 20 / 16px in a row on the light
   ground. If it dies at 20px, fix the mark, not the ladder.
3. **Lockups** — wordmark alone; horizontal; stacked; RTL horizontal with a
   Hebrew tagline. Clear space as a multiple of some measure taken *from the
   mark itself*, drawn as a dashed keyline. Minimum sizes in px and mm.
4. **Colourways** — the lockup on `#F6F8FA`, white, the band `#07202B`, solid
   teal, and black. Plus one-colour teal, navy, and black-on-white side by side.
5. **App icon** — iOS 1024 square; Android foreground on `#0E8C8C` with the
   safe circle overlaid, then under all three masks; and a home-screen mock-up
   among real third-party icons, light and dark wallpaper. An icon that only
   looks good in isolation is untested.
6. **Splash** — mark at 160px on a 1284×2778 canvas, light `#F6F8FA` and dark
   `#07202B`, wordmark and tagline below: `Train · Track · Progress` /
   `אימון · מעקב · התקדמות` / `Тренируйся · Отслеживай · Прогресс`.
7. **Notification icon** — Android status bar: white silhouette on transparent,
   96×96, no interior detail beyond what survives alpha-only rendering. The
   strictest reduction of the mark; if it can't be made, the mark is too
   complex.
8. **Two applied surfaces** — the Play feature graphic at 1024×500 on the band,
   and a gym-wall check-in poster (the QR members scan at the door, lockup
   above, A4 portrait) — the one place the brand gets printed and touched.

## How to work

Give **one** resolved direction, not options to choose between. With it: a
short rationale — what the mark is built from, why that form argues for
core / structure / load, what you rejected. Then the geometry precisely enough
to hand to an engineer: construction ratios, stroke weight as a fraction of the
mark's height, corner radii, exact hexes per element, and the optical
adjustments that differ from the mathematical grid. It gets redrawn as an SVG,
so it needs to be reconstructable, not traced.

## Avoid — these read as generic fitness software

A dumbbell or barbell silhouette. A flexed bicep. A heartbeat line. A globe. A
leaf or lotus. An abstract speed swoosh. A shield. A hexagon or gradient blob
containing a letterform. A lowercase geometric-sans wordmark with a coloured
dot. Teal-to-purple gradients. A negative-space person made of two circles and
an arc. Anything that would look identical with the name swapped out.
