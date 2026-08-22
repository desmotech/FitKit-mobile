> **Archived 2026-07-09 — historical.** Everything in the "Outstanding mobile work" list below has shipped. The My Forms list lives at `app/(tabs)/profile/forms/index.tsx` and the authenticated signing screen at `app/(tabs)/profile/forms/[instanceId].tsx` (NOT the `app/forms/instances/[instanceId].tsx` path this doc prescribes). The signature placeholder it says to replace is long gone (`src/components/forms/fields/signature-field.tsx`). Kept for design rationale only — do not build from it.

# Forms (FIT-176 / FIT-178) — Mobile Handover

**Date written:** 2026-05-27
**API branch:** `forms` in `../taikan` (commit not yet merged to main)
**Linear refs:** FIT-176 (engine), FIT-178 (mobile signing UX), FIT-184 (spike)

This document briefs an agent on `../taikan-mobile` so it can finish the
member-side signing surface. The API side shipped the full backend
pipeline (schema, PDF, R2, agent tools, auto-issue on onboarding) — what
mobile still needs is described below.

The mobile repo already has:
* `app/forms/sign/[token].tsx` — public token-gated signing screen
* `src/hooks/use-form-token.ts` — token-based fetch + submit
* `src/hooks/use-forms.ts` — authenticated `useMyForms` + `useFormInstance` + `useSubmitFormInstance`
* `src/components/forms/form-renderer.tsx` + 9 field renderers under `fields/`
* `src/types/forms.ts`

So most of the rendering / hook plumbing is in place. The work is wiring
the **default in-app flow** end-to-end, plus closing two specific gaps
where mobile's assumptions diverged from what the API actually returns.

---

## 1. The two flows

Both submit to the same legal pipeline server-side (PDF render → SHA-256 →
R2 upload to `taikan-compliance` bucket → append `form_signatures` audit
row → flip `pending → signed` → null the `signing_token`).

| Flow | When | Auth |
|---|---|---|
| **In-app default** | Member is logged into the mobile app, opens "My Forms" list | Clerk JWT |
| **Token-gated** | Cold links via WhatsApp/SMS (parental consent, studio rental, pre-install onboarding) — staff generates explicitly via the web UI | None — 64-hex token in URL |

The in-app path is what 95% of members hit. The token path covers edge
cases the API explicitly opted to keep. Both are first-class.

---

## 2. API contract — current state

### Authenticated (in-app)

**`GET /organizations/:orgId/forms/mine`** ✅
Returns `{ data: { instance, form }[] }` — joined envelope, matches what
mobile's `useMyForms` already expects. Order: newest `createdAt` first.
Excludes archived rows.

**`GET /organizations/:orgId/forms/instances/:instanceId`** ✅
Returns `{ data: { instance, form } }` — same envelope as `/mine` entries.
Caller must be the assignee OR org staff (owner/admin/coach); other
authenticated users get `403`. Mobile's `useFormInstance` cache-fallback
is no longer needed but harmless to keep.

**`POST /organizations/:orgId/forms/instances/:instanceId/submit`**
Body: `{ answers: FormAnswers }`. Returns `{ data: FormInstanceResponse }`.
The server verifies the Clerk caller is the instance's `assigneeUserId`
(staff can't sign on a member's behalf — would defeat the legal point).

### Token-gated (public)

**`GET /forms/sign/:token`**
Returns `{ data: { instance, form } }`. Marks `openedAt` on first read.
Returns `410 Gone` if the token expired (7 days), `404` if not found,
`400` if malformed (< 32 chars).

**`POST /forms/sign/:token/submit`**
Same envelope, transitions `pending → signed`, **burns the token** (single-use
per FIT-158).

**`POST /forms/sign/:token/signature-upload`** ✅
Public, token-gated. No body. Returns `{ data: { uploadUrl, r2Key, expiresInSeconds } }`
where `uploadUrl` is a presigned PUT URL restricted to `Content-Type: image/png`
and a server-managed R2 key under `signatures/{orgId}/{instanceId}/{ts}.png`
in the **default** R2 bucket (not the compliance bucket — the PNG is a
transient asset; the PDF is the legal record). 5-minute TTL on the URL.
Mobile flow: upload PNG → submit answer with `{ signatureField: { r2Key } }`.

---

## 3. The 9 field types

Discriminated union (canonical source: `libs/shared/src/lib/schemas/forms.ts`
in the API repo, mirrored in `src/types/forms.ts` here):

```ts
| { id, label, required, helpText?, type: 'text',         maxLength? }
| { id, label, required, helpText?, type: 'free_text',    maxLength? }
| { id, label, required, helpText?, type: 'checkbox' }
| { id, label, required, helpText?, type: 'date' }
| { id, label, required, helpText?, type: 'number',       min?, max?, unit? }
| { id, label, required, helpText?, type: 'scale',        min, max }       // defaults 1..5
| { id, label, required, helpText?, type: 'photo',        multiple }
| { id, label, required, helpText?, type: 'multi_choice', options: {value,label}[], allowMultiple }
| { id, label, required, helpText?, type: 'signature' }
```

Answers shape (keyed by field `id`):
```ts
type FormAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | { r2Key: string; mime?: string }          // photo (single) OR signature
  | { r2Key: string; mime?: string }[]        // photo (multiple)

type FormAnswers = Record<string, FormAnswerValue>
```

Server-side validation runs through Zod (`formAnswersSchema`) plus a
per-field `required` check. Submit returns `400` with an `issues` array
if either fails.

---

## 4. Signature upload — both paths now unblocked

The API contract assumes the signature image is already in R2 when
`submit` is called — the answer payload carries `{ r2Key, mime? }`. Server
fetches the bytes from R2 to embed in the PDF.

**In-app (authenticated)**: use the existing `UploadsService` presigned-PUT
flow (same pattern as progress photos / message attachments — see
`src/hooks/use-upload.ts` + `src/hooks/use-message-uploads.ts`). Capture
PNG → upload → reference `r2Key` in answers.

**Token-gated (public)**: call `POST /forms/sign/:token/signature-upload`
(documented above). Returns a presigned PUT URL + server-managed `r2Key`.
PUT the PNG bytes, then reference the `r2Key` on submit.

**Action for the mobile agent**: drop the inline-SVG placeholder in
`src/components/forms/form-renderer.tsx`. Wire both signature upload
paths against their respective endpoints. The submit handler should
pass `answers[signatureFieldId] = { r2Key, mime: 'image/png' }`.

---

## 5. Photo fields — same model

Photos in compliance forms are rare (FIT-158 doesn't enumerate any), but
the field type exists for check-ins (FIT-183, separate ticket). Same
upload-then-reference pattern: capture image → `useUpload` → reference
`r2Key` in answers. Already established for progress photos in this
repo.

---

## 6. Auth model & deep linking

**In-app**: standard Clerk-authenticated session. The "My Forms" list
sits in the authenticated nav, push notification taps deep-link into
`app/forms/instances/[instanceId].tsx` (new screen — to be added; mobile
has the hooks ready).

**Token**: `app/forms/sign/[token].tsx` already there. Deep-link comes
via Universal Link (`app.taikan.fit/forms/sign/<token>`) once AASA
deployment lands (FIT-188).

---

## 7. Error states the UI needs to handle

| Status | When | UI |
|---|---|---|
| `400` BadRequest | Malformed answers, missing signature r2Key, missing required field | Surface `issues` array if present; otherwise generic "Please review your answers" |
| `403` Forbidden | Authenticated submit by non-assignee (staff trying to sign on member's behalf) | "Only the form's assignee can sign this" |
| `404` Not Found | Token doesn't exist, or instance not in org | "Form not found" — already handled in token screen |
| `409` Conflict | Status transition blocked (already signed, archived, etc.) | "This form is already signed" |
| `410` Gone | Token expired past 7-day TTL | "Link expired — ask your gym for a new one" — already handled |
| `500` | PDF render / R2 upload failed server-side | "Submission failed — please try again"; the instance stays `pending` so retry is safe |

---

## 8. Hebrew RTL + i18n

The API stores `locale` on each form (`he` / `en` / `ru`). The renderer
should switch text direction off `form.locale === 'he'` independent of
the app's current language — a Hebrew form needs to render RTL even if
the member's UI is in English. The token-signing screen already does
this via the `dir` prop on `useI18n`; verify the authenticated list +
instance screens do the same.

Form labels + body_richtext come Hebrew-by-default for the 6 compliance
presets shipped by the API. The mobile app does not need to translate
these — render as-is.

---

## 9. What the API will NOT do for you

* **No member-side write to `form_instances` except the `submit` endpoint.** All other mutations (assign, generate-link, publish, etc.) are staff-only and live in the web dashboard.
* **No PDF rendering on mobile.** Mobile sends answers; server renders. Mobile never sees the PDF — only the staff dashboard can download via a presigned URL from the compliance R2 bucket.
* **No signing-token generation on mobile.** Token is staff-issued from the web UI.

---

## 10. Outstanding mobile work (recommended order)

1. **Build the authenticated "My Forms" list screen**. Use `useMyForms` (already exists). Group by `status` (Pending — coach is waiting on me, Signed — done, Archived — historical). Tap a Pending row → navigate to instance signing screen.
2. **Build the authenticated instance signing screen** (`app/forms/instances/[instanceId].tsx`). Reuse `<FormRenderer>` from the token flow; only the data hook changes (`useFormInstance` vs `useFormByToken`). The submit handler calls `useSubmitFormInstance` instead of `useSubmitFormByToken`.
3. **Wire signature upload** (Path A above): capture PNG → `useUpload` presigned PUT → r2Key → submit payload. Drop the inline-SVG placeholder.
4. **Push-notification deep-link**: when a server-side notification fires (FIT-18 / FIT-170), tapping it should route into `app/forms/instances/[instanceId].tsx`.
5. **Validate against the API gap**: confirm `/forms/mine` returns the `{ instance, form }` envelope mobile expects, or coordinate with the API team to ship that join. Until then, mobile will render with empty form metadata in the list.

---

## 11. Things already on the API that mobile gets for free

* Auto-issue on member onboarding: when a new active member joins the org (invite accepted or lead converted), the server auto-creates pending instances for every compliance template the coach toggled "auto-issue on join". Member opens "My Forms" → sees them waiting. No mobile work.
* Online-org gating: members in `organization.type='online'` orgs never see compliance forms — the API short-circuits all compliance routes for them. Mobile doesn't need a feature gate, but defensively the "My Forms" empty state should render correctly when the list is empty.
* PDF + audit row: written server-side on every successful submit. Mobile doesn't render anything for it.
* Signing-link expiry: token-based forms return `410 Gone` after 7 days. Already handled in the token screen.

---

## 12. Reference

* API source of truth for endpoint shapes: `apps/api/src/forms/forms.controller.ts` and `apps/api/src/forms/forms.service.ts` in the `forms` branch of `../taikan`
* Shared Zod schemas: `libs/shared/src/lib/schemas/forms.ts` in `../taikan`
* Compliance presets (for understanding what fields a `health_declaration` will carry on the wire): `libs/shared/src/lib/schemas/forms-presets.ts` in `../taikan`
* Linear: FIT-176 (engine, this is where the API work was tracked), FIT-178 (this mobile UX ticket), FIT-184 (the spike that drove the shared-schema design), FIT-189 (token-scoped signature upload — server-side, blocks Path B above), FIT-188 (universal link AASA deployment)
