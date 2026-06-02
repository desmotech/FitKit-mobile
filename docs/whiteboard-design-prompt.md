# Prompt — "Whiteboard" design system + a viewable screen

Paste the block below into Claude (artifacts / "design"). It's fully
self-contained — it reproduces the FitKit "Whiteboard" art direction as a
runnable **web** artifact so the look + micro-interactions can be reviewed
without building the React Native app. Edit the "screen to build" section to
preview other screens with the same reusable styling.

---

You are a senior product designer and front-end engineer. Produce a **single self-contained React artifact** (React + Tailwind classes, `lucide-react` icons, and `framer-motion` for animation) that delivers TWO things:

1. **A reusable styling foundation** — design tokens + a few primitive components, in a clearly-commented `REUSABLE` block at the top so they can be lifted into other screens.
2. **One viewable screen** — the structured-workout **"Program Sheet"** for a gym / CrossFit member app, rendered inside a ~390px phone frame, **dark mode by default** with a working light/dark toggle.

## Art direction — "Whiteboard" (this is the whole point)
The metaphor is a gym's **chalk whiteboard / printed training program / scoreboard**: editorial, high-contrast, typographic, athletic, confident. Premium and distinctive — Fuse / Linear / Teenage-Engineering restraint, NOT a generic fitness template.

**Explicitly avoid (these read as "AI-generated"):** teal-gradient-on-white; a wall of identical rounded cards; system/default font; soft drop shadows on everything; emoji; centered "cute-icon + subtitle" empty states; purple-blue SaaS gradients; pill buttons everywhere.

**Do instead:** big expressive display type with tight negative tracking; **monospace numerals treated as a feature** (loads, reps, times, dates read like a scoreboard); near-monochrome matte surfaces with ONE decisive accent; depth via layering + hairlines, not drop shadows; editorial layout with a numbered timeline spine; physics-based micro-interactions.

## Design tokens (put these in the commented REUSABLE block)
Colors — **dark-first** (the lead identity), plus a light theme:
- Dark: `bg #0B0B0D` · `surface #141417` · `surface2 #1B1B1F` · `text #F3F0E9` · `muted #9A958A` · `border #26262B` · `primary(teal) #27C8BA` · `energy(volt) #D7FF3E` · `sage #8AA86A` · `rust #E0685C` · `amber #C9974D`
- Light: `bg #F6F4EE` · `surface #FCFBF7` · `text #161512` · `muted #6E695E` · `border #E3DFD4` · `primary #0E8C8C` · `energy #D7FF3E`
- `energy` (volt) is the high-signal accent — use sparingly (today, PRs, the one primary moment) and always with ink-colored text on top of it.

Type — load with fallbacks:
- Display: **Clash Grotesk** — `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@500,600,700&display=swap">` (fallback: Space Grotesk).
- Body/UI: **Manrope** · Mono: **DM Mono** · Hebrew display: **Rubik** · Hebrew body: **Alef** (all Google Fonts; include Hebrew so RTL works).
- Ramp — size / line-height / letter-spacing: hero 40/42/−1.4 · title 30/34/−0.8 · heading 22/26/−0.4 · subhead 17/22/−0.2 · body 15/22/0 · caption 13/18/0 · kicker 11/14/+1.6 (uppercase, mono).

Geometry & depth: radii 8 / 12 / 16 / 20 / pill; 4pt spacing grid; 1px hairline borders in the low-contrast `border` color; reserve a single soft shadow for the one elevated element (the primary CTA / selected day).

Motion (framer-motion springs): press `{stiffness:320,damping:14}` → scale 0.96; selection-slide `{stiffness:220,damping:18}`; expand `{stiffness:180,damping:16}`; a slow "today" volt pulse (looping opacity/scale); staggered section reveals (~32ms step). Everything spring-driven; reserve plain opacity fades only for crossfades.

## Reusable primitives to implement
- `Kicker` — uppercase mono label.
- `Stamp` — outlined mono badge ("FOR TIME", "12 MIN"); primary variant uses the teal border + text.
- `Scoreboard` — N mono numerals on hairline columns (big value + tiny mono label).
- `RailCell` — a day slab: weekday (mono) over date (display). **Selected = an inverted ink/paper "stamp"** that springs up with a fill+text color crossfade; thin status bar under the date (sage = done, teal = has, rust = missed); "today" gets a volt dot + slow pulse.
- `SectionRow` — a numbered marker (01 / 02 / 03) joined by a vertical hairline **spine**, with a display heading + mono kicker; expands with a spring.
- `PrimaryButton` — confident, full-width, teal, Manrope-SemiBold label, springy press.

## The screen to build — "Program Sheet" (use realistic CrossFit data)
Top → bottom inside the phone frame:
1. **Date rail** — a horizontal week of `RailCell`s; "today" is selected.
2. **Poster hero** — mono date kicker ("WED · 14 MAY") → big display workout name ("Helen") → a row of `Stamp`s ("FOR TIME", "TIME CAP 12 MIN") → a `Scoreboard` (18 MIN duration / 3 sections / 9 movements).
3. **Sections on the spine**:
   - `01 · WARM-UP` — display heading "3 ROUNDS"; a few exercise rows.
   - `02 · STRENGTH` — display "BACK SQUAT"; rows with prescriptions like **"5 × 5 @ 80%"** in big mono.
   - `03 · METCON` — display "AMRAP 12"; rows ("3 RFT", "12 KB Swings", "9 Pull-ups", "400m Run") with **one row expanded** to reveal a `Scoreboard` (Sets / Reps / Load), 2 form cues, and a "Watch demo" link.
4. **Primary CTA** — "Log result" (`PrimaryButton`) — the single elevated/accented element.

## Output requirements
- One runnable artifact: tokens + primitives at the top (commented `REUSABLE`), the screen below.
- Dark by default; working light/dark toggle.
- Phone frame ~390px wide; content scrolls.
- Real micro-interactions: rail selection slide, section expand spring, button press, today pulse, staggered reveal on mount.
- **Every number uses the mono font; every heading uses the display font; no system font anywhere.**
- Accessible: roles, visible focus, sufficient contrast.
