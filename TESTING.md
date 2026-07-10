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

Hard-won gotchas, already handled centrally — don't regress them:

1. **Never import `@clerk/clerk-expo` unmocked** — it holds the Jest process
   open. The global mock in `test/setup.ts` covers everything.
2. **Test QueryClients need `gcTime: Infinity` for queries AND mutations**
   (`makeTestQueryClient` does this) — a finite gcTime schedules a 5-minute
   GC timer that stalls Jest's exit.
3. **RNTL v14's `act` is async** — a bare `act(() => mutate())` leaks an
   unawaited act scope and later `renderHook` mounts commit as `null`.
   Always `await act(async () => ...)`.
4. **`useApiQuery` hardcodes its own retry (3× with backoff for non-401s)**,
   overriding the test client's `retry: false`. Error-path tests for screens
   on `useApiQuery` either use a 401 (fails fast by design) or a generous
   `findByText` timeout. If fast 500-path tests ever matter screen-wide,
   `useApiQuery` would need to respect the client default.
5. **Duplicated a11y labels** (visible caption + TextInput sharing one
   label): select the editable node —
   `getAllByLabelText(l).find(el => el.type === 'TextInput')`.

## What's covered today

Pure logic:
- **Date/week logic** (`src/lib/week.ts`) — local-calendar-day invariants,
  week anchoring (he=Sunday, en/ru=Monday), month labels. TZ-matrix-proofed.
- **Query-key contract** (`src/lib/query-keys.ts`) — persisted-cache shapes.
- **Score codec** (`src/lib/score.ts`) — clock parsing, AMRAP rounds+reps,
  decimal-comma weights, completeness rules, wire round-trips.
- **Booking state machine** (`use-schedule.ts`) — every CTA state, plan
  selection and block reasons.
- **Prescription formatting** (`format-prescription.ts`) — all load kinds,
  section headers, legacy flat fallback.
- **Assignment state** (`use-workouts` helpers), **workout time estimates**,
  **week-glance booking flags**, **price formatting**, **role labels**,
  **org selection** (`pickActiveMembership`), **locale resolution**.

Hooks over MSW (real cache, staged network):
- **Booking mutations** — optimistic confirm/waitlist flip while the POST is
  in flight, rollback on error, server reconciliation after settle; cancel
  frees the spot; self-checkin posts exact gps/qr bodies.
- **Messages** — send appends the server row (send is NOT optimistic — a
  failed send never shows a ghost message), markRead flips only unread
  incoming rows and never retries in a loop.

Screens (member drives the real UI; only the network is staged):
- **Announcements** — populated / empty / error-with-retry / recovery /
  tap-to-read marks read on the server.
- **Workout result logging** — Save gating, exact payload contract
  (score serialization, local-noon `performedAt`, `assignmentId` forking,
  rx/scaled flags incl. the Modified-can't-persist limitation), untouched
  prefilled sets are never sent, failure keeps the member on the screen.
- **Sign-in** — Clerk error mapping (wrong password / unknown account),
  session activation + navigation, TOTP second-factor stage, busy state.
- **AuthGate** — the full redirect chain: loader, signed-out → sign-in,
  auth-error screen with retry on /users/me failure, legal-consent and
  complete-profile redirects, happy path.
- **Home** — today's workout / rest day / error (never a misleading open
  day) / goals populated + empty nudge; asserts the Sunday-anchored
  weekStart actually requested.
- **Lift + metric logging** — Save gating, exact POST bodies (local-noon
  timestamps), PR celebration, failure copy.
- **QueryErrorState** — copy, retry, screen-reader name.

## Remaining roadmap

1. Schedule screens (list day-rail + session detail CTA rendering; the
   scan/checkin QR+GPS screens with camera/location permission states).
2. Messages screens (inbox states, thread inverted list + pagination,
   composer disabled-while-uploading).
3. Profile hub + subscreens (history, PRs, metrics, goals CRUD, photos,
   notification prefs, sign-out clears caches).
4. Onboarding (complete-profile validation per field, accept-terms).
5. Workout detail (complete/uncomplete, unread chat badge) + whiteboard
   week paging; workout chat.
6. **Coverage ratchet** — add `coverageThreshold` to jest.config.js at the
   then-current numbers so coverage only goes up.
