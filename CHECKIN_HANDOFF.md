# Phase 4 handoff — member check-in answering (FIT-183)

The API + web-coach side of recurring check-in forms (FIT-183) is done and merged on the `fitkit` side. This is the **mobile member-answering** piece. It's small: the existing forms flow already does ~all of it — the only real change is **submitting check-in answers to a different endpoint** than compliance.

## What FIT-183 is

Coach-defined **recurring check-in forms** (mood/scale, bodyweight, free-text, photo) on a cadence. Distinct from compliance forms: no signature, no PDF, no legal pipeline — just typed answers captured over time and shown to the coach as a trend + review queue. Hebrew term is **"הענות תקופתית"** (NOT "צ׳ק-אין" — that's session/class attendance; keep them separate in copy).

## API contract (all live on `main`)

- `GET /organizations/:orgId/forms/mine` → `{ data: { instance, form }[] }`
  **Already returns check-in instances** (`instance.kind === 'check_in'`) alongside compliance — no filter needed. Check-in instances have `status` ∈ `scheduled | sent | answered | reviewed`.
- `GET /organizations/:orgId/forms/instances/:instanceId` → `{ data: { instance, form } }` — same envelope; works for check-in instances too.
- **NEW — the only new endpoint to call:**
  `POST /organizations/:orgId/check-ins/instances/:instanceId/answers`
  body: `{ answers: Record<fieldId, FormAnswerValue> }`
  → `{ data: FormInstanceResponse }` (status flips to `answered`; the server auto-emits the next occurrence). Auth: the caller must be the assignee. No signature, no PDF.

`FormAnswerValue` (from `@fitkit/shared`): string | number | boolean | string[] | `{ r2Key, mime? }` | `{ r2Key, mime? }[]`.

## What already exists in this app (reuse it)

- `src/hooks/use-forms.ts` — `useMyForms`, single-instance fetch, and the **compliance** submit (`POST /forms/instances/:id/submit`).
- `app/(tabs)/profile/forms/index.tsx` (My Forms list) + `[instanceId].tsx` (answer screen) + `<FormRenderer>` — already renders `number`, `scale`, `free_text`, `photo`, `multi_choice`, etc., with the R2 photo upload flow.
- i18n: dictionaries now have a single source in `@fitkit/shared` (FIT-191). Check-in strings exist under `checkIns.*` (`tab`, `empty`, `assign.*`, `reviewQueue.*`) and `forms.kind.checkIn` = "הענות תקופתית". Add any new answering-flow strings to `libs/shared/src/lib/i18n/dictionaries/{en,he,ru}.json`.

## The change (scope)

1. **Submit branch by kind.** In the answer screen / submit hook, when `instance.kind === 'check_in'`, POST to `…/check-ins/instances/:id/answers` with `{ answers }` instead of the compliance `…/submit`. Compliance path stays exactly as-is.
   - Check-in has **no signature field** and **no PDF** — on success just show a confirmation and pop back; don't run/await any PDF/download logic.
   - Validation: required fields only (the server re-validates against the template's `fields`). No signature requirement for check-in.
2. **List affordance (optional polish).** In My Forms, check-in rows can show a "הענות תקופתית" badge and route to the same answer screen. They already appear via `/forms/mine`.
3. **Invalidate** the `/forms/mine` query on success so the answered row updates.

## Out of scope

- Compliance flow — unchanged.
- Coach review queue / trend — already built on web; not a mobile concern for this ticket.
- Scheduling/recurrence — entirely server-side (`@Cron` in `apps/api/src/check-ins/check-in-scheduler.service.ts`). The app only answers; the server emits the next occurrence.

## Testing

Follow the app's existing forms test pattern. Cover: a `check_in` instance submits to the answers endpoint (not the compliance submit) with the typed answers; success invalidates `/forms/mine`.

## Notes / gotchas

- Push deep-links for check-ins use route `forms/${instanceId}` with `data.instanceId` (see the dispatch cron payload) — the existing deep-link handling should already land on the answer screen.
- Notification copy is localized server-side by the form's locale; the app doesn't render the reminder text.
- Reminder on terminology: **check-in (this feature) = "הענות תקופתית"**; session attendance check-in stays "צ׳ק-אין".
