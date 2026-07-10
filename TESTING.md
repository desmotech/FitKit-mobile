# Testing

Stack: **jest-expo** (Expo's official Jest preset) + **React Native Testing
Library v14** (note: `render`/`fireEvent` are async — always `await`) +
**MSW** (network mocking at the `fetch` boundary).

```sh
pnpm test              # full suite
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage report
```

CI runs the suite under a timezone matrix (`UTC`, `Asia/Jerusalem`,
`America/New_York`) — date/week tests must pass in all of them.

## Philosophy: test what the member experiences

Tests assert **user-visible behavior**, never implementation details. The
rule of thumb: a refactor that keeps behavior identical must keep every test
green; a change that breaks a member-facing flow must turn something red.

Concretely:

- **Mock only at the edges.** The network (MSW handlers per test) and
  third-party SDKs that can't run in Node (Clerk, Sentry, PostHog, native
  modules — mocked once in `test/setup.ts`). Never mock app code: hooks,
  components, and lib modules run for real.
- **Query what the member sees.** `getByText`, `getByRole` with accessible
  names — not testIDs, not component internals, not hook state.
- **Assert copy from the real dictionaries** (`dictionaries.he` from
  `@fitkit/shared`) so copy edits don't break tests, but missing
  translations do surface.
- **Exception — contract tests:** `src/lib/__tests__/query-keys.test.ts`
  deliberately pins exact query-key shapes, because members' persisted
  on-device caches depend on them. Changing a shape needs a cache-migration
  story, not an updated assertion.

## Infrastructure map

| File | Purpose |
|---|---|
| `jest.config.js` | jest-expo preset, transform list, coverage config |
| `test/setup-env.ts` | env vars before framework load |
| `test/setup.ts` | edge mocks (Clerk, storage, Sentry/PostHog, reanimated, safe-area) + MSW lifecycle |
| `test/msw.ts` | MSW server + `api(path)` URL helper (`server.use(...)` per test; unhandled requests fail the test) |
| `test/render.tsx` | `renderWithProviders` — the app's provider stack (i18n/org/query/safe-area); Hebrew signed-in member by default |
| `test/mocks/clerk.ts` | mutable Clerk state (`mockAuthState`, `mockSignIn`); auto-resets after each test |
| `test/fixtures.ts` | API response factories (`userMe`, `membership`, `announcement`, `stageSignedInMember`) |

Two hard-won gotchas, already handled centrally — don't regress them:

1. **Never import `@clerk/clerk-expo` unmocked** — it holds the Jest process
   open. The global mock in `test/setup.ts` covers everything.
2. **Test QueryClients need `gcTime: Infinity` for queries AND mutations**
   (`makeTestQueryClient` does this) — a finite gcTime schedules a 5-minute
   GC timer that stalls Jest's exit.

## What's covered today

- **Date/week logic** (`src/lib/week.ts`) — local-calendar-day invariants,
  week anchoring (he=Sunday, en/ru=Monday), month labels. TZ-matrix-proofed.
- **Query-key contract** (`src/lib/query-keys.ts`) — persisted-cache shapes.
- **Score codec** (`src/lib/score.ts`) — clock parsing, AMRAP rounds+reps,
  decimal-comma weights, completeness rules, wire round-trips.
- **Booking state machine** (`use-schedule.ts`) — every CTA state
  (book/waitlist/cancel/cancelLocked/leave/checkedIn/full/closed), plan
  selection and block reasons.
- **Org selection** (`pickActiveMembership`) and **locale resolution**
  (`src/i18n/config.ts`).
- **QueryErrorState** component — copy, retry, screen-reader name.
- **Announcements screen** (full integration over MSW) — populated / empty /
  error-with-retry / recovery / tap-to-read marks read on the server.

## Roadmap (highest value first)

1. **Result logging** (`app/log/workout/[id].tsx`) — set seeding from
   prescriptions, `canSubmit` rules, exact POST payload (RPE decimal-comma,
   `performedAt` local-noon anchoring, `assignmentId`).
2. **Schedule flows** — book/cancel optimistic updates + rollback on error;
   session detail CTA; QR/GPS check-in state transitions.
3. **AuthGate redirect chain** — signed-out → sign-in; legal-consent and
   incomplete-profile gates; auth-error screen (not silent redirect).
4. **Sign-in screen** — Clerk error mapping (wrong password / not found /
   pwned), MFA stages, reset flow (drive via `test/mocks/clerk.ts`).
5. **Messages** — optimistic send, markRead latch, inverted-list pagination.
6. **Home screen** — today's workout/rest/open-day states, goals states.
7. **Lift/PR/metric logging** — scoring inference, celebration gating on
   `improved`, payload shapes.
8. **Coverage ratchet** — once the flows above land, add
   `coverageThreshold` to jest.config.js at the then-current numbers so
   coverage only goes up.
