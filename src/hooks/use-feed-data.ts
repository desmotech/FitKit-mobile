import { useApiQuery, useApiAction, useApiSend } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  MemberCancellationResponse,
  PersonalRecordResponse,
  BodyMetricSummaryResponse,
  SubscriptionWithPlan,
} from '@taikan/shared';

/**
 * Member-side data hooks. All org-scoped endpoints take orgId so we
 * skip the request until the active organization is resolved.
 *
 * Endpoint paths mirror what apps/web hits:
 *   GET /organizations/:orgId/members/me/stats
 *   GET /organizations/:orgId/personal-records/me
 *   GET /organizations/:orgId/metrics/me
 *   GET /organizations/:orgId/subscriptions/my
 *   POST /organizations/:orgId/subscriptions/:id/renew
 */

export interface ApiEnvelope<T> {
  data: T;
}

// ── Today's workout ─────────────────────────────────────────

export interface TodayWorkoutLite {
  id: string;
  name?: string | null;
  category?: string | null;
  estimatedDurationMinutes?: number | null;
  exerciseCount?: number | null;
  summary?: string | null;
}

export function useTodayWorkout() {
  return useApiQuery<ApiEnvelope<TodayWorkoutLite | null>>({
    path: '/workout-assignments/today',
    queryKey: ['/workout-assignments/today'],
  });
}

// ── Today's class sessions (for the Feed daily-class card) ──

export interface TodayClassSession {
  id: string;
  classType: { id: string; name: string };
  startsAt: string | null;
  endsAt: string | null;
  coach: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  organization: { name: string; logoUrl: string | null };
  location: { id: string; name: string } | null;
  myBookingStatus: 'confirmed' | 'waitlisted' | 'attended' | null;
  workouts: {
    id: string;
    title: string | null;
    displayName: string;
    description: string | null;
    scoring: string;
    timeCap: number | null;
  }[];
}

export function useTodayClassSessions(orgId: string | undefined | null) {
  const path = orgId
    ? `/organizations/${orgId}/sessions/today-workouts`
    : '';
  return useApiQuery<ApiEnvelope<TodayClassSession[]>>({
    path,
    queryKey: orgId
      ? queryKeys.sessions.todayWorkouts(orgId)
      : ['/sessions/today-workouts', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

// ── Member stats (classes this month + total) ───────────────

export interface MyStats {
  classesThisMonth: number;
  totalClasses: number;
}

export function useMyStats(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/members/me/stats` : '';
  return useApiQuery<ApiEnvelope<MyStats>>({
    path,
    queryKey: orgId
      ? queryKeys.members.myStats(orgId)
      : ['/members/me/stats', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

// ── Goals ──────────────────────────────────────────────────

export interface GoalLite {
  id: string;
  name: string;
  category?: string | null;
  current?: number | string | null;
  target?: number | string | null;
  unit?: string | null;
  progressPct?: number | null;
  dueAt?: string | null;
}

export function useMyGoals() {
  return useApiQuery<ApiEnvelope<GoalLite[]>>({
    path: '/goals/me',
    queryKey: ['/goals/me'],
  });
}

// ── Body metric samples (for Feed sparklines) ───────────────

export interface BodyMetricSample {
  id: string;
  metric: string;
  value: number;
  unit?: string | null;
  recordedAt: string;
}

export function useMyMetrics() {
  return useApiQuery<ApiEnvelope<BodyMetricSample[]>>({
    path: '/metrics/me',
    queryKey: ['/metrics/me'],
  });
}

// ── Body metric summary (for Profile body-metrics card) ─────

export function useMyBodyMetricsSummary(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/metrics/me` : '';
  return useApiQuery<ApiEnvelope<BodyMetricSummaryResponse[]>>({
    path,
    queryKey: orgId
      ? queryKeys.metrics.summary(orgId)
      : ['/metrics/me', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

// ── Personal records ───────────────────────────────────────

export type PersonalRecordLite = PersonalRecordResponse & {
  // Loose alternates kept for older Feed call sites.
  exercise?: string;
  recordedAt?: string;
  delta?: string | null;
};

// ── Hook: search exercises (for PR entry) ───────────────────

export interface ExerciseSearchResult {
  id: string;
  name: string;
  category?: string;
  primaryMuscles?: string[];
}

export function useExerciseSearch(
  orgId: string | undefined | null,
  query: string,
) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (orgId) params.set('orgId', orgId);
  params.set('limit', '12');
  const path = query ? `/exercises/search?${params.toString()}` : '';
  return useApiQuery<ApiEnvelope<ExerciseSearchResult[]>>({
    path,
    queryKey: queryKeys.exercises.search(orgId, query),
    queryOptions: { enabled: query.length >= 2 },
  });
}

// ── Hook: log a manual PR ────────────────────────────────────

export interface LogPRInput {
  exerciseId?: string;
  workoutId?: string;
  value: string;
  unit: string;
  achievedAt?: string;
}

export function useLogManualPR(orgId: string | undefined | null) {
  return useApiSend<ApiEnvelope<unknown>, LogPRInput>({
    path: orgId ? `/organizations/${orgId}/personal-records/me` : '',
    method: 'POST',
  });
}

export function useMyPersonalRecords(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/personal-records/me` : '';
  return useApiQuery<ApiEnvelope<PersonalRecordResponse[]>>({
    path,
    queryKey: orgId
      ? queryKeys.personalRecords.mine(orgId)
      : ['/personal-records/me', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

// ── Announcements (Feed coach note) ─────────────────────────

export interface AnnouncementLite {
  id: string;
  body: string;
  publishedAt?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
  isPinned?: boolean;
}

export function useLatestAnnouncement() {
  return useApiQuery<ApiEnvelope<AnnouncementLite[]>>({
    path: '/announcements?limit=1',
    queryKey: ['/announcements', 'latest'],
  });
}

// ── Subscriptions ──────────────────────────────────────────

export type SubscriptionLite = SubscriptionWithPlan & {
  daysRemaining?: number | null;
};

/**
 * `enabled` gates the request beyond having an org — Home only needs this
 * payload for a gym that hasn't opened yet, and paying for it on every other
 * home render would be a request the screen never reads. Defaults to on, so
 * existing callers are unchanged.
 */
export function useMySubscription(
  orgId: string | undefined | null,
  enabled = true,
) {
  return useApiQuery<ApiEnvelope<SubscriptionLite[]>>({
    path: orgId ? `/organizations/${orgId}/subscriptions/my` : '',
    queryKey: orgId
      ? queryKeys.subscriptions.all(orgId, { mine: true })
      : ['/subscriptions/my', 'noop'],
    queryOptions: { enabled: !!orgId && enabled },
  });
}

/**
 * Renew a past_due/cancelled subscription. Web POSTs without a body to
 * `/organizations/:orgId/subscriptions/:id/renew`; mutation accepts the
 * subscription id and resolves to the refreshed subscription envelope.
 */
export function useRenewSubscription(orgId: string | undefined | null) {
  return useApiAction<ApiEnvelope<SubscriptionLite>, string>({
    path: (id: string) =>
      `/organizations/${orgId}/subscriptions/${id}/renew`,
    method: 'POST',
  });
}

/**
 * FIT-282 follow-up (early renewal / "renew now" — BoostApp parity, mobile
 * mirror of web's early-renew-dialog.tsx). Distinct from
 * {@link useRenewSubscription}: THIS one only accepts an `active`
 * subscription — a member who ran out of quota before the period ends pays
 * now to open a fresh period immediately, instead of waiting it out.
 */
export function useEarlyRenewSubscription(orgId: string | undefined | null) {
  return useApiAction<ApiEnvelope<SubscriptionLite>, string>({
    path: (id: string) =>
      `/organizations/${orgId}/subscriptions/my/${id}/renew-early`,
    method: 'POST',
  });
}

/**
 * Member: give notice of cancellation. The membership ends one month later —
 * the API computes that date and returns it as `cancellationEffectiveAt`, which
 * callers should display rather than deriving an end date from a billing
 * period. `reason` (free text) and `reasonCode` (the fixed taxonomy) are both
 * optional and independent — a member can pick a chip, write something, both,
 * or neither. Reversible via {@link useResumeCancellation} until it takes
 * effect.
 *
 * Answers with `MemberCancellationResponse`, NOT `SubscriptionLite`: this
 * endpoint serializes the subscription without its plan, and it carries the
 * extra `cancellationFormInstanceId` — the gym's written cancellation form,
 * which the caller routes the member into signing. Null means there is
 * nothing to sign (no template published by the org, issuance failed, or the
 * org's `cancellation-form-prompt` flag is off), and the caller just confirms
 * the end date. Never a reason to hold anything up: the notice is already
 * recorded by the time this resolves.
 */
export function useCancelAtPeriodEnd(orgId: string | undefined | null) {
  return useApiSend<
    ApiEnvelope<MemberCancellationResponse>,
    {
      id: string;
      reason?: string;
      reasonCode?:
        | 'relocation'
        | 'financial'
        | 'dissatisfaction'
        | 'health'
        | 'schedule'
        | 'no_longer_needed'
        | 'other';
    }
  >({
    path: (b) =>
      `/organizations/${orgId}/subscriptions/my/${b.id}/cancel-at-period-end`,
    method: 'POST',
  });
}

/** Member: undo a scheduled cancellation before it takes effect. */
export function useResumeCancellation(orgId: string | undefined | null) {
  return useApiSend<ApiEnvelope<SubscriptionLite>, { id: string }>({
    path: (b) => `/organizations/${orgId}/subscriptions/my/${b.id}/resume`,
    method: 'POST',
  });
}

/**
 * Member: cancel their OWN `pending` subscription — a checkout they started
 * and never finished. Mirrors web's cancel-pending-checkout-dialog.tsx.
 *
 * No longer flag-gated: the API dropped the per-org
 * `subscription-member-cancel-pending` gate, so every `pending` row comes
 * back with `cancel_pending` among its actions. The client still renders off
 * what the server says the member may do rather than assuming it.
 */
export function useCancelPendingSubscription(orgId: string | undefined | null) {
  return useApiSend<ApiEnvelope<SubscriptionLite>, CancelPendingBody>({
    path: (b) =>
      `/organizations/${orgId}/subscriptions/my/${b.id}/cancel-pending`,
    method: 'POST',
  });
}

/**
 * `intent` / `source` are optional and additive — omitting them keeps the
 * endpoint's original behavior byte for byte.
 *
 * `'regret'` says the member deliberately rolled their OWN checkout back (as
 * opposed to the 24h sweep or a staff void). The row is still stamped
 * `abandoned_checkout` server-side so a late webhook can revive it, but a
 * regretted one is hidden from the member's own lists: they said they did not
 * want it, and leaving the ghost "complete payment" membership on their
 * profile is the bug this whole flow exists to fix.
 */
export interface CancelPendingBody {
  id: string;
  intent?: 'regret' | 'abandon';
  source?: 'return_page' | 'profile' | 'shop';
}

/**
 * Member: withdraw from a membership that has not started yet (presale /
 * future-start, `status: 'scheduled'`).
 *
 * NOT {@link useCancelAtPeriodEnd}, which the API refuses on a scheduled row
 * (409 `USE_WITHDRAW`) — and which used to leave one stuck forever: it
 * stamped a notice date that the due-cancellations sweep never looked at, so
 * the row held its seat with `cancelAtPeriodEnd` set and no way out. There is
 * no period to run out here, nothing was ever charged, so there is no notice
 * month, no refund math and no cancellation form. The seat is released
 * immediately and the member can buy the plan again.
 */
export function useWithdrawScheduled(orgId: string | undefined | null) {
  return useApiAction<ApiEnvelope<SubscriptionLite>, string>({
    path: (id: string) =>
      `/organizations/${orgId}/subscriptions/my/${id}/withdraw`,
    method: 'POST',
  });
}

/**
 * Member self-service card registration. Returns a hosted payment-page URL to
 * open in the in-app browser (same pattern as plan checkout).
 */
export function useRegisterPaymentMethod(orgId: string | undefined | null) {
  return useApiSend<
    ApiEnvelope<{ paymentPageUrl: string }>,
    { successUrl: string; cancelUrl: string }
  >({
    path: orgId ? `/organizations/${orgId}/payment-methods/register` : '',
    method: 'POST',
  });
}
