/**
 * Booking state machine. `classBookState` + `decideBookingPlan` are the
 * single source of truth for which button a member sees on a class and
 * what happens when they tap it — the highest-stakes decision logic in
 * the schedule flow.
 */
import {
  canCancelBooking,
  classBookState,
  decideBookingPlan,
  differenceInMinutes,
  timeOfDayBucket,
  type BookingPlanEntry,
  type ClassSession,
} from '../use-schedule';

const NOW = new Date('2026-07-10T10:00:00Z').getTime();
const IN_AN_HOUR = new Date(NOW + 60 * 60_000).toISOString();
const AN_HOUR_AGO = new Date(NOW - 60 * 60_000).toISOString();

function session(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 'sess_1',
    classTypeId: 'ct_1',
    title: null,
    startsAt: IN_AN_HOUR,
    endsAt: new Date(NOW + 120 * 60_000).toISOString(),
    capacity: 12,
    waitlistCapacity: 3,
    status: 'published',
    notes: null,
    classType: { id: 'ct_1', name: 'CrossFit', color: null, defaultDurationMin: 60 },
    location: null,
    coach: null,
    workouts: [],
    attendees: [],
    bookingCount: 5,
    capacityRemaining: 7,
    myBookingStatus: null,
    myCheckedInAt: null,
    myCheckinMethod: null,
    cancellationDeadline: null,
    cancellationWindowHours: 0,
    allowLateCancellation: false,
    ...overrides,
  };
}

function plan(overrides: Partial<BookingPlanEntry> = {}): BookingPlanEntry {
  return {
    subscriptionId: 'sub_1',
    planName: 'Unlimited',
    planType: 'subscription',
    remainingCredits: null,
    bookingsToday: 0,
    bookingsThisWeek: 0,
    maxPerDay: null,
    maxPerWeek: null,
    allowOverlapping: false,
    hasOverlap: false,
    blocked: false,
    blockReason: null,
    ...overrides,
  };
}

describe('classBookState — which button the member sees', () => {
  it('offers Book on an open class with room', () => {
    expect(classBookState(session(), NOW)).toBe('book');
  });

  it('offers the waitlist when the class is full but the waitlist has room', () => {
    expect(
      classBookState(session({ capacityRemaining: 0 }), NOW),
    ).toBe('waitlist');
  });

  it('shows Full when both class and waitlist are exhausted', () => {
    expect(
      classBookState(
        session({ capacityRemaining: 0, waitlistCapacity: 0 }),
        NOW,
      ),
    ).toBe('full');
    expect(
      classBookState(
        session({ capacityRemaining: 0, waitlistCapacity: null }),
        NOW,
      ),
    ).toBe('full');
  });

  it('closes booking once the class has started', () => {
    expect(classBookState(session({ startsAt: AN_HOUR_AGO }), NOW)).toBe('closed');
    // Exactly at the start time counts as started.
    expect(
      classBookState(session({ startsAt: new Date(NOW).toISOString() }), NOW),
    ).toBe('closed');
  });

  it('offers Cancel while my booking is inside the cancellation window', () => {
    expect(
      classBookState(
        session({
          myBookingStatus: 'confirmed',
          cancellationDeadline: IN_AN_HOUR,
        }),
        NOW,
      ),
    ).toBe('cancel');
  });

  it('locks cancellation after the deadline passes', () => {
    expect(
      classBookState(
        session({
          myBookingStatus: 'confirmed',
          cancellationDeadline: AN_HOUR_AGO,
        }),
        NOW,
      ),
    ).toBe('cancelLocked');
  });

  it('still allows cancelling past the deadline when the gym permits late cancellation', () => {
    expect(
      classBookState(
        session({
          myBookingStatus: 'confirmed',
          cancellationDeadline: AN_HOUR_AGO,
          allowLateCancellation: true,
        }),
        NOW,
      ),
    ).toBe('cancel');
  });

  it('always lets me leave a waitlist', () => {
    expect(
      classBookState(
        session({
          myBookingStatus: 'waitlisted',
          cancellationDeadline: AN_HOUR_AGO,
        }),
        NOW,
      ),
    ).toBe('leave');
  });

  it('is terminal once I have checked in', () => {
    expect(
      classBookState(session({ myBookingStatus: 'attended' }), NOW),
    ).toBe('checkedIn');
    expect(
      classBookState(
        session({
          myBookingStatus: 'confirmed',
          myCheckedInAt: AN_HOUR_AGO,
        }),
        NOW,
      ),
    ).toBe('checkedIn');
  });

  it('treats unlimited-capacity classes as always bookable before start', () => {
    expect(
      classBookState(session({ capacity: null, capacityRemaining: null }), NOW),
    ).toBe('book');
  });
});

describe('canCancelBooking', () => {
  it('allows cancelling when there is no deadline at all', () => {
    expect(canCancelBooking(session(), NOW)).toBe(true);
  });
});

describe('decideBookingPlan — what happens when the member taps Book', () => {
  it('books directly when the server sent no eligibility (staff / legacy)', () => {
    expect(decideBookingPlan(session())).toEqual({ kind: 'proceed' });
    expect(
      decideBookingPlan(
        session({ bookingEligibility: { status: 'staff', plans: [] } }),
      ),
    ).toEqual({ kind: 'proceed' });
  });

  it('books without credit tracking in the free-gym model (eligible, no plans)', () => {
    expect(
      decideBookingPlan(
        session({ bookingEligibility: { status: 'eligible', plans: [] } }),
      ),
    ).toEqual({ kind: 'proceed' });
  });

  it('pins the subscriptionId when exactly one plan is usable', () => {
    const decision = decideBookingPlan(
      session({
        bookingEligibility: {
          status: 'eligible',
          plans: [
            plan({ subscriptionId: 'sub_a' }),
            plan({ subscriptionId: 'sub_b', blocked: true, blockReason: 'no_credits' }),
          ],
        },
      }),
    );
    expect(decision).toEqual({ kind: 'proceed', subscriptionId: 'sub_a' });
  });

  it('asks the member to choose when several plans are usable', () => {
    const decision = decideBookingPlan(
      session({
        bookingEligibility: {
          status: 'eligible',
          plans: [plan({ subscriptionId: 'sub_a' }), plan({ subscriptionId: 'sub_b' })],
        },
      }),
    );
    expect(decision.kind).toBe('pick');
    if (decision.kind === 'pick') {
      expect(decision.plans.map((p) => p.subscriptionId)).toEqual([
        'sub_a',
        'sub_b',
      ]);
    }
  });

  it.each([
    ['no plan at all', 'no_plan' as const],
    ['an inactive membership', 'membership_inactive' as const],
  ])('explains the block for %s', (_l, status) => {
    const decision = decideBookingPlan(
      session({ bookingEligibility: { status, plans: [] } }),
    );
    expect(decision).toEqual({ kind: 'blocked', reason: status, plan: null });
  });

  it('surfaces the first plan’s block reason when every plan is blocked', () => {
    const blocked = plan({ blocked: true, blockReason: 'weekly_limit' });
    const decision = decideBookingPlan(
      session({
        bookingEligibility: { status: 'all_plans_blocked', plans: [blocked] },
      }),
    );
    expect(decision).toEqual({
      kind: 'blocked',
      reason: 'weekly_limit',
      plan: blocked,
    });
  });
});

describe('schedule display helpers', () => {
  it('buckets classes into morning/afternoon/evening by local start hour', () => {
    const at = (h: number) => new Date(2026, 6, 10, h, 0).toISOString();
    expect(timeOfDayBucket(at(7))).toBe('morning');
    expect(timeOfDayBucket(at(13))).toBe('afternoon');
    expect(timeOfDayBucket(at(19))).toBe('evening');
  });

  it('reports class duration in minutes and never negative', () => {
    expect(differenceInMinutes(AN_HOUR_AGO, IN_AN_HOUR)).toBe(120);
    expect(differenceInMinutes(IN_AN_HOUR, AN_HOUR_AGO)).toBe(0);
  });
});
