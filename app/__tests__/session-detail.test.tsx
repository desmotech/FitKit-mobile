/**
 * Session detail — member vs. staff capacity count (FIT-243).
 *
 * With waitlist now unlimited-when-on, a raw booking count next to the
 * member's booking state is misleading. Members must see only their booking
 * state (e.g. "Waitlisted"), never the `booked/capacity` number. Staff keep
 * it. These tests pin exactly that: the count is hidden for a member and
 * shown for a coach, while the class still renders for both.
 *
 * The screen reads its session from the week cache (GET /sessions), so we
 * stage that; the direct /sessions/:id fallback stays disabled.
 */
import { screen } from '@testing-library/react-native';
import SessionDetailScreen from '../(tabs)/schedule/[id]';
import { membership, stageSignedInMember, userMe } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sess_1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

/** A published class with a capacity count of 12/15. */
function detailSession(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const startsAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // +6h, future
  return {
    id: 'sess_1',
    classTypeId: 'ct_1',
    title: null,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
    capacity: 15,
    waitlistCapacity: 5,
    status: 'published',
    notes: null,
    classType: { id: 'ct_1', name: 'CrossFit WOD', color: null, defaultDurationMin: 60 },
    location: { id: 'loc_1', name: 'Main Floor' },
    coach: { id: 'coach_1', firstName: 'Dana', lastName: 'Cohen', imageUrl: null },
    workouts: [],
    attendees: [],
    bookingCount: 12,
    capacityRemaining: 3,
    myBookingStatus: null,
    myCheckedInAt: null,
    myCheckinMethod: null,
    cancellationDeadline: null,
    cancellationWindowHours: 2,
    allowLateCancellation: false,
    isStaff: false,
    bookingEligibility: { status: 'eligible', plans: [] },
    ...overrides,
  };
}

function stageSession(session: Record<string, unknown>) {
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/sessions`), () =>
      HttpResponse.json({ data: [session] }),
    ),
    // Direct fetch the detail sheet fires before the week cache resolves.
    http.get(api(`/organizations/${TEST_ORG}/sessions/${session.id}`), () =>
      HttpResponse.json({ data: session }),
    ),
  );
}

describe('Session detail — capacity count visibility', () => {
  it('hides the booked/capacity count from a member (waitlisted → state only)', async () => {
    stageSignedInMember();
    stageSession(detailSession({ myBookingStatus: 'waitlisted', isStaff: false }));

    await renderWithProviders(<SessionDetailScreen />);

    // The class renders…
    expect(await screen.findByText('CrossFit WOD')).toBeOnTheScreen();
    // …but the raw fullness count is not shown to the member.
    expect(screen.queryByText('12/15')).not.toBeOnTheScreen();
  });

  it('keeps the booked/capacity count for staff (coach)', async () => {
    stageSignedInMember(
      userMe({ memberships: [membership({ role: 'coach' })] }),
    );
    stageSession(detailSession({ isStaff: true }));

    await renderWithProviders(<SessionDetailScreen />);

    expect(await screen.findByText('CrossFit WOD')).toBeOnTheScreen();
    expect(screen.getByText('12/15')).toBeOnTheScreen();
  });
});
