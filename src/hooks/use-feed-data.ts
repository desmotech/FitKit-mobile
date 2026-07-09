import { useApiQuery, useApiAction, useApiSend } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  PersonalRecordResponse,
  BodyMetricSummaryResponse,
  SubscriptionWithPlan,
} from '@fitkit/shared';

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
      ? ['/organizations', orgId, 'sessions', 'today-workouts']
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
      ? ['/organizations', orgId, 'members', 'me', 'stats']
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
      ? ['/organizations', orgId, 'metrics', 'me']
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
    queryKey: ['/exercises/search', { orgId, q: query }],
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
      ? ['/organizations', orgId, 'personal-records', 'me']
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

export function useMySubscription(orgId: string | undefined | null) {
  return useApiQuery<ApiEnvelope<SubscriptionLite[]>>({
    path: orgId ? `/organizations/${orgId}/subscriptions/my` : '',
    queryKey: orgId
      ? queryKeys.subscriptions.all(orgId, { mine: true })
      : ['/subscriptions/my', 'noop'],
    queryOptions: { enabled: !!orgId },
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
 * Member: schedule cancellation at end of the current period. `reason` is
 * required by the API. Reversible via {@link useResumeCancellation} until the
 * period actually ends.
 */
export function useCancelAtPeriodEnd(orgId: string | undefined | null) {
  return useApiSend<
    ApiEnvelope<SubscriptionLite>,
    { id: string; reason: string }
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
 * Member: request immediate cancellation + refund. Opens a
 * `cancellation_requests` row for the gym owner to approve — not an instant
 * cancel.
 */
export function useRequestCancellation(orgId: string | undefined | null) {
  return useApiSend<
    ApiEnvelope<unknown>,
    { id: string; reason: string; refundRequested: boolean }
  >({
    path: (b) =>
      `/organizations/${orgId}/subscriptions/my/${b.id}/cancellation-requests`,
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
