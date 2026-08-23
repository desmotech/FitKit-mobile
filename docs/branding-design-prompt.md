# Prompt — Taikan logo + brand kit

Paste the block below into Claude Design. It's fully self-contained — it
carries the Ocean palette, the type stack, the asset sizes this repo actually
builds against, and the three writing systems the app ships in, so the output
can be exported straight into `assets/images/` and `store-assets/`.

Two things to settle **before** pasting:

1. **The name story.** The brief defaults to 体幹 *taikan* — Japanese for the
   body's trunk / core, the thing every other lift is built on. If the name
   came from somewhere else (大観, "the grand view"; an acronym; nothing at
   all), edit that paragraph — it's the single input that most changes what
   comes back.
2. **What replaces the globe.** The brief tells the designer the current
   ribbon-globe is being retired. If you want it evolved rather than
   replaced, say so there.

---

You are a brand designer building the identity for a product that has just
been renamed. Produce a **brand kit as a multi-artboard design canvas** — the
full system, not a single logo sketch.

## The company

**Taikan** is a B2B SaaS platform for real-world fitness businesses — gyms,
CrossFit boxes, studios, and independent coaches. Those businesses subscribe
to run their operations on it: memberships, class scheduling, programming,
payments, member comms.

There are two audiences, and the identity has to hold both:

- **Gym owners and coaches** — they see the web dashboard. They are running a
  business. They want software that looks like a serious operational tool,
  not a wellness app.
- **Members** — they see the mobile app (iOS + Android). They open it in a
  loud gym, sweaty, between sets: to check today's programming, scan a QR
  code at the door, log a set, watch a PR go up.

The product was called **FitKit** until last week. The rename is real —
new bundle id, new domain (`taikan.fit`, `usetaikan.com`), new store
listing. The identity has to earn the new name rather than dress up the old
one.

**The name.** 体幹 — *taikan* — is Japanese for the trunk of the body: the
core, the load-bearing centre everything else moves around. Athletes train it
first because nothing else holds without it. That's the brand's whole
argument for itself: Taikan is the core the gym is built around. Build the
identity on that idea. Don't put a kanji character in the logo and don't make
it look like a martial-arts dojo — the reference is structural, not
decorative.

**Positioning words:** structural · disciplined · calm under load · earned,
not hyped. **Not:** hustle-culture, neon, gamified, "wellness", medical.

## What already exists (and is not up for redesign)

The colour system and type stack shipped with the rebrand and are live in the
web app, the marketing site, and the mobile app. **Design the mark into this
palette — do not propose a new one.**

**Ocean — light** (the primary ground):
`bg #F6F8FA` · `surface #FFFFFF` · `ink #0D1B2A` · `muted-ink #4A5A6E` ·
`border #DCE3EA` · **`teal #0E8C8C`** (brand fill; small teal text uses
`#0A6E6E` for AA) · **`mint #2E7A4D`** (highlight/positive — today, PRs,
streaks) · `amber #A8792F` · `slate #3D5A70` · `rust #B84A40`

**Ocean — dark / "band"** (the deep teal-navy full-bleed from the marketing
site):
`bg #07202B` · `surface #0C2B38` · `ink #EAF2F4` · `muted-ink #C8D9DF` ·
`border #2B424B` · **`teal #2AB8B8`** · **`mint #B0E5C4`**

Teal is the brand. Mint is the one highlight accent, used sparingly. Navy is
the ink. There is no fourth colour.

**Type** (both Google Fonts, both cover Latin + Hebrew; Rubik also covers
Cyrillic):
- Display / headings — **Rubik** (Medium 500, SemiBold 600, Bold 700, Black 900) — Latin + Hebrew + Cyrillic
- Body / UI — **Assistant** (Regular → ExtraBold) — Latin + Hebrew only
- **Manrope** carries body text in Russian, because Assistant has no Cyrillic.
  Rubik still handles Russian headings.
- Numerals are set in Assistant with `tabular-nums`; there is no separate mono face.

The wordmark should be drawn from Rubik — customised, tightened, redrawn
where it earns it — so it sits in the same family as the product UI rather
than floating above it. Show the base weight you started from.

**The mark being retired:** a 3D ribbon-globe with an ECG pulse line running
through it, rendered in teal-to-navy gradients. It fails for reasons worth
naming, because they are the constraints on its replacement: it only exists
as a 1024px raster, the ribbons collapse into mud below ~32px, the gradients
can't reduce to one colour, and "globe + heartbeat" says telemedicine, not
strength training. Replace it.

## Hard constraints — these are what the mark lives or dies on

1. **It must read at 20px.** It is a tab-bar icon, a notification icon, a
   favicon, and a 24px avatar before it is anything else. Design the mark
   small first and scale it up, not the reverse.
2. **Flat vector geometry.** No gradients in the primary mark, no bevels, no
   3D, no drop shadows, no photographic texture. A flat one-colour version
   must be the *same* mark, not a simplification of it.
3. **It must survive one colour.** Solid teal, solid navy, solid white
   knocked out of the band, and pure black — all with no loss of meaning.
   Any counter (enclosed white space) has to stay open when the mark is
   printed 8mm wide on a gym door decal.
4. **Three writing systems.** The product ships English, **Hebrew (RTL)**, and
   Russian. "Taikan" itself stays Latin in every locale — it's a brand name —
   but the lockups with a tagline flip. Show the horizontal lockup mirrored
   for RTL with the Hebrew tagline set in Rubik, and confirm the mark itself
   is not directional (nothing that reads as an arrow or a swoosh pointing
   one way, which reverses meaning when mirrored).
5. **Android adaptive icon.** The foreground must sit inside the 66/108 safe
   circle and still look right when the OS masks it to a circle, a squircle,
   or a rounded square. Show all three masks.
6. **iOS icon.** 1024×1024, no alpha, no rounded corners of your own, no
   transparency — the OS applies the mask.

## Artboards to produce

Lay these out on one canvas, grouped and labelled.

**1 · The mark**
The symbol alone, large, on light. Beside it: the construction — the grid,
circle, or angle system it's built from, with the ratios called out. A logo
that can't be reconstructed from a rule isn't finished.

**2 · Size ladder**
The same mark rendered at 512 / 128 / 64 / 32 / 24 / 20 / 16px in a row, all
on the light ground, unscaled-in-place so the small end is honest. If it dies
at 20px, fix the mark, not the ladder.

**3 · Wordmark and lockups**
Wordmark alone. Horizontal lockup (mark + wordmark). Stacked lockup. RTL
horizontal lockup with the Hebrew tagline. Each with clear-space defined as a
multiple of some measure taken *from the mark itself*, drawn as a dashed
keyline. Minimum sizes in px and mm.

**4 · Colourways**
The lockup on: light ground `#F6F8FA` · white · the band `#07202B` · solid
teal `#0E8C8C` · pure black · pure white knockout. Plus the one-colour teal,
one-colour navy, and pure-black-on-white marks side by side.

**5 · Misuse**
Six things not to do, each drawn wrong with a short caption: don't rotate,
don't recolour outside the palette, don't add effects, don't stretch, don't
place on a busy photo without the scrim, don't rebuild the lockup by
eyeballing the spacing.

**6 · Palette sheet**
Every colour above as a swatch with hex, role, and the contrast ratio of its
text pairing. Mark which pairs pass AA at normal size and which are
large-text-only. Show light and dark rows.

**7 · Type sheet**
The ramp set in all three scripts: English and Hebrew in Rubik/Assistant,
Russian in Rubik/Manrope.
Hero 40/42/−1.4 · title 30/34/−0.8 · heading 22/26/−0.4 · subhead 17/22/−0.2 ·
body 15/22/0 · caption 13/18/0 · kicker 11/14/+1.6 uppercase. Show a tabular
numeral row — `225 kg · 5×5 · 12:04 · +18%` — because numbers are the
product's loudest content.

**8 · App icon**
iOS 1024 square (no alpha). Android adaptive: foreground on the teal
background `#0E8C8C`, with the safe circle overlaid, then the same icon under
circle / squircle / rounded-square masks. A home-screen mock-up showing the
icon among real third-party icons in both light and dark wallpaper — an icon
that only looks good in isolation is not tested.

**9 · Splash**
The mark centred on `#F6F8FA` (light) and `#07202B` (dark), mark at 160px
wide on a 1284×2778 canvas. Below it: the wordmark and the tagline
`Train · Track · Progress` — shown also as `אימון · מעקב · התקדמות` and
`Тренируйся · Отслеживай · Прогресс`.

**10 · Notification icon**
Android status-bar icon: pure white silhouette on transparent, 96×96, no
interior detail beyond what survives the alpha-only rendering the OS applies.
This is the strictest reduction of the mark — if it can't be made, the mark
is too complex.

**11 · Applied surfaces**
Four, small: (a) the Play Store feature graphic at 1024×500 on the band;
(b) a gym-wall check-in poster — the QR code members scan at the door, with
the lockup above it, A4 portrait, because this is the one place the brand is
printed and touched; (c) an OG / social card at 1200×630; (d) a member
avatar placeholder — the mark in a 96px circle.

## How to work

Give **one** coherent direction, resolved and defended — not three options to
choose between. Alongside the artboards, write a short rationale: what the
mark is built from, why that form argues for *core / structure / load*, and
what you deliberately rejected.

Then state the geometry precisely enough to hand to an engineer: the
construction ratios, the stroke weight as a fraction of the mark's height,
the corner radii, the exact hexes per element, and the optical adjustments
that differ from the mathematical grid. The engineer redraws this as an SVG —
it needs to be reconstructable, not traced.

## Avoid — these read as generic fitness software

A dumbbell or barbell silhouette. A flexed bicep. A heartbeat / ECG line. A
generic globe. A leaf, a lotus, or anything spa-adjacent. An abstract swoosh
implying speed. A shield. A hexagon or gradient blob containing a letterform.
A lowercase geometric-sans wordmark with a coloured dot. Teal-to-purple
gradients. A negative-space person made of two circles and an arc. Anything
that would look identical with the name swapped out.
