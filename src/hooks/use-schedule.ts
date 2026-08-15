/**
 * Schedule hooks — class sessions, bookings, check-in.
 */
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { analytics } from '@/lib/analytics';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';
import type { WorkoutLite } from './use-workouts';
import {
  offlineMutationKeys,
  type BookSessionVars,
  type CancelBookingVars,
  type QueuedMutationContext,
} from '@/lib/offline-queue';
import { OFFLINE_GC_TIME } from '@/lib/query-persister';
import { queryKeys } from '@/lib/query-keys';

// Mirrors the canonical `ClassSessionResponse` from
// libs/shared/src/lib/schemas/scheduling.schema.ts. Kept loose to avoid a
// hard coupling — only the fields the mobile UI consumes are typed strictly.
export interface ScheduleAttendee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

export interface ScheduleCoach {
  /** Membership id for an org-member coach; null for a one-time external
   *  (guest) coach, whose display name arrives in firstName. */
  id: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  isExternal?: boolean;
}

export interface ScheduleClassType {
  id: string;
  name: string;
  color: string | null;
  defaultDurationMin: number | null;
}

export interface ScheduleLocation {
  id: string;
  name: string;
}

export type SessionStatus = 'draft' | 'published' | 'cancelled';
export type MyBookingStatus = 'confirmed' | 'waitlisted' | 'attended';

// ── Booking eligibility (mirrors BookingEligibility in scheduling.schema.ts) ──

// Must stay in step with `bookingBlockReasonValues` in
// libs/shared/src/lib/schemas/scheduling.schema.ts. A reason missing here
// falls through `blockReasonText`'s switch and the member gets an alert with
// an empty body — `monthly_limit` did exactly that until this was widened.
export type BookingBlockReason =
  | 'no_credits'
  | 'overlap'
  | 'daily_limit'
  | 'weekly_limit'
  | 'monthly_limit'
  | 'credits_expired'
  | 'plan_ends_before_session';

export interface BookingPlanEntry {
  subscriptionId: string;
  planName: string;
  planType: 'subscription' | 'class_pack' | 'drop_in' | 'course';
  remainingCredits: number | null;
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  maxPerDay: number | null;
  maxPerWeek: number | null;
  maxPerMonth: number | null;
  allowOverlapping: boolean;
  hasOverlap: boolean;
  blocked: boolean;
  blockReason: BookingBlockReason | null;
  /** When this plan stops covering the member (punch-card expiry, or the
   *  effective end date under notice). Optional: responses from an API build
   *  that predates the field simply omit it, and the copy falls back to a
   *  date-less phrasing. */
  planEndsAt?: string | null;
}

export interface BookingEligibility {
  status:
    | 'eligible'
    | 'staff'
    | 'no_plan'
    | 'membership_inactive'
    | 'all_plans_blocked';
  plans: BookingPlanEntry[];
}

export interface ClassSession {
  id: string;
  classTypeId: string;
  title: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  capacity: number | null;
  waitlistCapacity: number | null;
  status: SessionStatus;
  notes: string | null;
  classType: ScheduleClassType;
  location: ScheduleLocation | null;
  coach: ScheduleCoach | null;
  /** Optional workout previews attached to the session. */
  workouts: WorkoutLite[];
  attendees: ScheduleAttendee[];
  bookingCount: number;
  capacityRemaining: number | null;
  myBookingStatus: MyBookingStatus | null;
  myCheckedInAt: string | null;
  myCheckinMethod: 'manual' | 'qr' | 'gps' | null;
  cancellationDeadline: string | null;
  cancellationWindowHours: number;
  allowLateCancellation: boolean;
  isStaff?: boolean;
  /** Per-plan booking eligibility computed by the server (null for staff-role
   *  responses that predate it — treated as "proceed without a plan"). */
  bookingEligibility?: BookingEligibility | null;
}

// ── Plan selection for booking ──────────────────────────────────────

export type BookingPlanDecision =
  /** Book now — with the given plan, or untracked when no plan applies. */
  | { kind: 'proceed'; subscriptionId?: string }
  /** Several usable plans — the member must choose one. */
  | { kind: 'pick'; plans: BookingPlanEntry[] }
  /** Booking is not possible; `reason` selects the explanatory copy. */
  | {
      kind: 'blocked';
      reason: 'no_plan' | 'membership_inactive' | BookingBlockReason;
      plan: BookingPlanEntry | null;
    };

/**
 * Decide how a booking should proceed from the server-computed eligibility.
 * ALWAYS returns an explicit subscriptionId when exactly one plan is usable
 * so multi-plan members never fall into the server's auto-pick, and blocked
 * members get told why locally instead of a server error round-trip.
 */
export function decideBookingPlan(session: ClassSession): BookingPlanDecision {
  const eligibility = session.bookingEligibility;
  if (!eligibility || eligibility.status === 'staff') {
    return { kind: 'proceed' };
  }
  if (eligibility.status === 'no_plan') {
    return { kind: 'blocked', reason: 'no_plan', plan: null };
  }
  if (eligibility.status === 'membership_inactive') {
    return { kind: 'blocked', reason: 'membership_inactive', plan: null };
  }
  // Free-gym model: eligible with no plans — book without credit tracking.
  if (eligibility.plans.length === 0) {
    return { kind: 'proceed' };
  }
  const unblocked = eligibility.plans.filter((p) => !p.blocked);
  if (eligibility.status === 'all_plans_blocked' || unblocked.length === 0) {
    const first = eligibility.plans[0] ?? null;
    return {
      kind: 'blocked',
      reason: first?.blockReason ?? 'no_credits',
      plan: first,
    };
  }
  if (unblocked.length === 1) {
    return { kind: 'proceed', subscriptionId: unblocked[0].subscriptionId };
  }
  return { kind: 'pick', plans: unblocked };
}

/**
 * GET /organizations/:orgId/sessions/:id — single-session detail.
 * Same payload shape as the list. Used by the detail sheet.
 */
export function useSessionDetail(
  orgId: string | undefined | null,
  sessionId: string | undefined,
) {
  const path =
    orgId && sessionId
      ? `/organizations/${orgId}/sessions/${sessionId}`
      : '';
  return useApiQuery<ApiEnvelope<ClassSession>>({
    path,
    queryKey:
      orgId && sessionId
        ? queryKeys.sessions.byId(orgId, sessionId)
        : ['/sessions/:id', 'noop'],
    queryOptions: { enabled: !!orgId && !!sessionId, gcTime: OFFLINE_GC_TIME },
  });
}

/**
 * GET /organizations/:orgId/sessions?weekStart=YYYY-MM-DD
 * Returns sessions whose `startsAt` falls in [weekStart, weekStart+7d).
 * Status filtering (published-only) happens client-side to match web.
 */
export function useMyWeekSessions(
  orgId: string | undefined | null,
  weekStart: string | undefined,
) {
  const path =
    orgId && weekStart
      ? `/organizations/${orgId}/sessions?weekStart=${weekStart}`
      : '';
  return useApiQuery<ApiEnvelope<ClassSession[]>>({
    path,
    queryKey:
      orgId && weekStart
        ? queryKeys.sessions.week(orgId, weekStart)
        : ['/sessions', 'noop'],
    // Readable with no signal — see OFFLINE_GC_TIME.
    queryOptions: { enabled: !!orgId && !!weekStart, gcTime: OFFLINE_GC_TIME },
  });
}

// ── Time-of-day bucket helpers ──────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

/** Mirrors the morning/afternoon/evening split shown in mocks. */
export function timeOfDayBucket(iso: string): TimeOfDay {
  const h = new Date(iso).getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function differenceInMinutes(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/**
 * Whether — and how — a member can act on a class. Single source of truth for
 * the Schedule list + the session detail so the CTA + status always agree:
 *
 *   book         → open with room (primary "Book")
 *   waitlist     → full but the waitlist has room (primary "Join waitlist")
 *   cancel       → I'm booked and can still cancel (within the window)
 *   cancelLocked → I'm booked but the cancellation window has passed
 *   leave        → I'm on the waitlist (leaving is always allowed)
 *   checkedIn    → terminal; I've already checked in
 *   full         → full with no waitlist room (not bookable)
 *   closed       → the class has started — the booking window has passed
 */
export type ClassBookState =
  | 'book'
  | 'waitlist'
  | 'cancel'
  | 'cancelLocked'
  | 'leave'
  | 'checkedIn'
  | 'full'
  | 'closed';

/** Whether a confirmed booking can still be cancelled (within the window, or
 *  late cancellation is allowed). Waitlist entries are not window-bound. */
export function canCancelBooking(
  session: ClassSession,
  now: number = Date.now(),
): boolean {
  const deadline = session.cancellationDeadline
    ? new Date(session.cancellationDeadline).getTime()
    : null;
  const pastWindow = deadline != null && now > deadline;
  return !pastWindow || session.allowLateCancellation;
}

export function classBookState(
  session: ClassSession,
  now: number = Date.now(),
): ClassBookState {
  const isCheckedIn =
    session.myBookingStatus === 'attended' || !!session.myCheckedInAt;
  if (isCheckedIn) return 'checkedIn';
  if (session.myBookingStatus === 'confirmed')
    return canCancelBooking(session, now) ? 'cancel' : 'cancelLocked';
  if (session.myBookingStatus === 'waitlisted') return 'leave';
  // Not my booking — can I still get in?
  if (now >= new Date(session.startsAt).getTime()) return 'closed';
  const isFull = session.capacity != null && session.capacityRemaining === 0;
  if (isFull) {
    const hasWaitlist =
      session.waitlistCapacity != null && session.waitlistCapacity > 0;
    return hasWaitlist ? 'waitlist' : 'full';
  }
  return 'book';
}

// ── Booking mutations ───────────────────────────────────────────────

/**
 * Both booking mutations are queued when the device is offline: React Query
 * pauses them, the persister writes them to disk, and they replay on
 * reconnect — even across an app kill (FIT-171). That imposes two rules on
 * everything below.
 *
 *  1. **Variables carry `orgId`.** A mutation restored from disk has no
 *     closure to read it from. This is why callers pass `orgId` explicitly
 *     rather than it being baked in by the hook.
 *
 *  2. **The request, the analytics and the cache reconciliation live in the
 *     mutation *defaults*** (`src/lib/offline-queue.ts`), not here — a
 *     restored mutation never runs this hook, so anything defined here would
 *     simply not happen for the case the queue exists to serve. What stays
 *     here is the part that only makes sense with a live screen attached:
 *     the optimistic write and its rollback.
 *
 * Per-call callbacks passed to `mutate(vars, { onSuccess … })` still run in
 * addition to the defaults', so screens keep their own alerts and spinners.
 */

export interface BookSessionInput {
  /** Optional — server picks the default eligible plan if omitted. */
  subscriptionId?: string;
}

type SessionsSnapshot = ApiEnvelope<ClassSession[]> | undefined;

/**
 * What `onMutate` hands to the shared outcome handler in offline-queue.ts.
 *
 * `queuedOffline` is the flag that tells a queued replay (nobody is looking;
 * a refusal has to surface in the banner) from a live tap (the screen alerts
 * it). `previous` is the optimistic rollback snapshot, absent offline because
 * nothing was written optimistically.
 */
type BookingMutationContext = QueuedMutationContext & {
  previous: SessionsSnapshot;
};

/**
 * POST /organizations/:orgId/sessions/:sessionId/book
 *
 * Optimistically flips `myBookingStatus` on the cached week list so the UI
 * reflects the new state before the server response lands — but ONLY while
 * online. Offline, the flip would be a promise the app cannot keep: capacity
 * and quota are server-authoritative, and a class can fill while the member
 * is underground. The row shows a "queued" stamp instead, driven by the
 * mutation's own paused state (see `useQueuedBookings`).
 */
export function useBookSession(
  orgId: string | undefined | null,
  weekStart: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey =
    orgId && weekStart
      ? queryKeys.sessions.week(orgId, weekStart)
      : (['/sessions', 'noop'] as const);

  return useMutation<
    ApiEnvelope<unknown>,
    Error,
    BookSessionVars,
    BookingMutationContext
  >({
    mutationKey: [...offlineMutationKeys.bookSession],
    onMutate: async ({ sessionId }) => {
      if (!onlineManager.isOnline()) {
        return { previous: undefined, queuedOffline: true };
      }
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<ApiEnvelope<ClassSession[]>>(queryKey);
      queryClient.setQueryData<SessionsSnapshot>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((s) => {
            if (s.id !== sessionId) return s;
            const isFull = s.capacity != null && s.capacityRemaining === 0;
            return {
              ...s,
              myBookingStatus: isFull ? 'waitlisted' : 'confirmed',
              bookingCount: s.bookingCount + (isFull ? 0 : 1),
              capacityRemaining:
                s.capacityRemaining != null
                  ? Math.max(0, s.capacityRemaining - (isFull ? 0 : 1))
                  : s.capacityRemaining,
            };
          }),
        };
      });
      return { previous, queuedOffline: false };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });
}

/**
 * DELETE /organizations/:orgId/sessions/:sessionId/book
 *
 * Optimistic in the same shape as booking, and offline-silent for the same
 * reason — see `useBookSession`.
 */
export function useCancelBooking(
  orgId: string | undefined | null,
  weekStart: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey =
    orgId && weekStart
      ? queryKeys.sessions.week(orgId, weekStart)
      : (['/sessions', 'noop'] as const);

  return useMutation<
    ApiEnvelope<unknown>,
    Error,
    CancelBookingVars,
    BookingMutationContext
  >({
    mutationKey: [...offlineMutationKeys.cancelBooking],
    onMutate: async ({ sessionId }) => {
      if (!onlineManager.isOnline()) {
        return { previous: undefined, queuedOffline: true };
      }
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<ApiEnvelope<ClassSession[]>>(queryKey);
      queryClient.setQueryData<SessionsSnapshot>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((s) => {
            if (s.id !== sessionId) return s;
            const wasConfirmed = s.myBookingStatus === 'confirmed';
            return {
              ...s,
              myBookingStatus: null,
              bookingCount: Math.max(0, s.bookingCount - (wasConfirmed ? 1 : 0)),
              capacityRemaining:
                s.capacityRemaining != null && wasConfirmed
                  ? s.capacityRemaining + 1
                  : s.capacityRemaining,
            };
          }),
        };
      });
      return { previous, queuedOffline: false };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });
}

/**
 * Whether a cancellation is safe to queue for later replay.
 *
 * Booking offline is a bet on capacity; cancelling offline is a bet on the
 * clock, and the clock is the one thing we can check. A cancellation replayed
 * after its deadline is refused — and worse, the member believes they are no
 * longer on the list and does not show up. So a cancellation whose window
 * closes before the member is plausibly back online is refused *locally*,
 * immediately, while there is still a screen to say so.
 *
 * The horizon is deliberately generous: an hour of walking out of a basement
 * gym, not a guess at how long the tube ride is.
 */
export const OFFLINE_CANCEL_HORIZON_MS = 60 * 60_000;

export function canQueueCancellation(
  session: ClassSession,
  now: number = Date.now(),
): boolean {
  if (session.allowLateCancellation) return true;
  if (!session.cancellationDeadline) return true;
  const deadline = new Date(session.cancellationDeadline).getTime();
  return deadline - now > OFFLINE_CANCEL_HORIZON_MS;
}

// ── Self check-in ───────────────────────────────────────────────────

export interface SelfCheckinInput {
  method: 'qr' | 'gps';
  /** QR-only — token from the QR payload. */
  token?: string;
  /** QR-only — unix-seconds expiry from the QR payload. */
  expiresAt?: number;
  /** GPS-only — current latitude. */
  latitude?: number;
  /** GPS-only — current longitude. */
  longitude?: number;
}

/**
 * POST /organizations/:orgId/sessions/:sessionId/self-checkin
 *
 * On success we refetch the week list so `myCheckedInAt` /
 * `myCheckinMethod` propagate everywhere.
 */
export function useSelfCheckin(
  orgId: string | undefined | null,
  weekStart: string | undefined,
) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();
  const queryKey =
    orgId && weekStart
      ? queryKeys.sessions.week(orgId, weekStart)
      : (['/sessions', 'noop'] as const);

  return useMutation<
    ApiEnvelope<unknown>,
    Error,
    { sessionId: string; body: SelfCheckinInput }
  >({
    mutationFn: ({ sessionId, body }) =>
      fetchWithAuth(
        `/organizations/${orgId}/sessions/${sessionId}/self-checkin`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ) as Promise<ApiEnvelope<unknown>>,
    onSuccess: (_data, { sessionId, body }) => {
      analytics.track('member_self_checkin', {
        org_id: orgId,
        session_id: sessionId,
        method: body.method,
        platform: 'mobile',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Best-effort error-message extractor for API error envelopes. */
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
