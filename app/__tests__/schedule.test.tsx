/**
 * Schedule list — the class-booking week view. These tests pin the
 * member-visible day states: staged classes render their name/coach/time
 * (fetched for the he-locale Sunday-anchored week), an empty day shows the
 * no-classes copy, a failed fetch shows the error card (never a misleading
 * "no classes"), and the row action matches my booking state (booked →
 * cancel, open → book).
 *
 * Network staged via MSW; the real hooks, week math, and row logic run.
 * Booking-mutation behavior is covered at hook level — here we only assert
 * what the member sees.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import ScheduleScreen from '../(tabs)/schedule/index';
import { scheduleStringsFor } from '@/i18n/schedule-strings';
import { getWeekStartDay, pad2, shiftWeek, weekStartFor } from '@/lib/week';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const S = scheduleStringsFor('he');

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// The weekStart the app derives for the Hebrew locale (Sunday-anchored),
// computed with the same lib functions the screen uses.
const WEEK_START = weekStartFor(new Date(), getWeekStartDay('he'));

/**
 * A start time guaranteed to be BOTH today and in the future in any host
 * timezone: `frac` of the way between now and the next local midnight.
 * (The list defaults to today's bucket, and an already-started class
 * renders as closed instead of bookable.)
 */
function futureToday(frac: number): Date {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (midnight.getTime() - now.getTime()) * frac);
}

function classSession(
  overrides: Record<string, unknown> = {},
  frac = 0.5,
): Record<string, unknown> {
  const startsAt = futureToday(frac);
  return {
    id: 'sess_1',
    classTypeId: 'ct_1',
    title: null,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
    capacity: 12,
    waitlistCapacity: 5,
    status: 'published',
    notes: null,
    classType: {
      id: 'ct_1',
      name: 'CrossFit WOD',
      color: null,
      defaultDurationMin: 60,
    },
    location: { id: 'loc_1', name: 'Main Floor' },
    coach: { id: 'coach_1', firstName: 'Dana', lastName: 'Cohen', imageUrl: null },
    workouts: [],
    attendees: [],
    bookingCount: 4,
    capacityRemaining: 8,
    myBookingStatus: null,
    myCheckedInAt: null,
    myCheckinMethod: null,
    cancellationDeadline: null,
    cancellationWindowHours: 2,
    allowLateCancellation: false,
    bookingEligibility: { status: 'eligible', plans: [] },
    ...overrides,
  };
}

/** Stage every read the schedule list + member header perform. */
function stageSchedule(sessions: Record<string, unknown>[] = []) {
  const requestedWeekStarts: (string | null)[] = [];
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/sessions`), ({ request }) => {
      requestedWeekStarts.push(
        new URL(request.url).searchParams.get('weekStart'),
      );
      return HttpResponse.json({ data: sessions });
    }),
    // Member header chrome (unread badges).
    http.get(api(`/organizations/${TEST_ORG}/announcements/unread-count`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
  );
  return { requestedWeekStarts };
}

beforeEach(() => {
  stageSignedInMember();
});

describe('Schedule — day list', () => {
  it("renders today's classes with name, coach and start time, fetched for the he-locale week", async () => {
    const session = classSession();
    const { requestedWeekStarts } = stageSchedule([session]);

    await renderWithProviders(<ScheduleScreen />);

    expect(await screen.findByText('CrossFit WOD')).toBeOnTheScreen();
    // Coach + location render as one meta line ("Dana Cohen · Main Floor").
    expect(screen.getByText(/Dana Cohen/)).toBeOnTheScreen();
    const start = new Date(session.startsAt as string);
    expect(
      screen.getByText(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`),
    ).toBeOnTheScreen();
    // The week query must be anchored the way the app anchors it for
    // Hebrew (Sunday) — a Monday-anchored request would drop Sunday classes.
    expect(requestedWeekStarts).toContain(WEEK_START);
  });

  it('shows the no-classes copy when nothing is scheduled today', async () => {
    stageSchedule([]);

    await renderWithProviders(<ScheduleScreen />);

    // Re-query inside waitFor: the header badge queries settle right after
    // the empty state appears and the re-render swaps the text instance.
    await waitFor(() =>
      expect(screen.getByText(S.noClassesToday)).toBeOnTheScreen(),
    );
  });

  it('shows the error card when the week fetch fails — never "no classes"', async () => {
    stageSchedule();
    server.use(
      // 401: fails fast by design (useApiQuery skips retries for it), so
      // the error card appears without waiting out the retry backoff.
      http.get(api(`/organizations/${TEST_ORG}/sessions`), () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );

    await renderWithProviders(<ScheduleScreen />);

    expect(await screen.findByText(S.loadFailedTitle)).toBeOnTheScreen();
    expect(screen.getByText(S.loadFailedSubtitle)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: S.tryAgain })).toBeOnTheScreen();
    // A failed fetch must never masquerade as an empty schedule.
    expect(screen.queryByText(S.noClassesToday)).not.toBeOnTheScreen();
  });

  it('shows the booked stamp + cancel on my confirmed class, and the book CTA on an open one', async () => {
    stageSchedule([
      classSession(
        { id: 'sess_mine', myBookingStatus: 'confirmed' },
        0.4,
      ),
      classSession({ id: 'sess_open' }, 0.7),
    ]);

    await renderWithProviders(<ScheduleScreen />);

    // My confirmed booking: "booked" stamp with a cancel affordance.
    expect(await screen.findByText(S.booked)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: S.cancelBooking }),
    ).toBeOnTheScreen();
    // The open class: a book CTA — and only that one row offers it.
    expect(screen.getByRole('button', { name: S.bookClass })).toBeOnTheScreen();
  });
});

describe('Schedule — week navigation', () => {
  it('shows the new week\'s classes immediately, without needing a day tap', async () => {
    // Regression: the selected day used to stay pinned to today when the
    // week changed, so next week's list looked up a date that week didn't
    // contain and fell through to the empty state until a cell was tapped.
    const nextWeekStart = shiftWeek(WEEK_START, 1);
    server.use(
      http.get(api(`/organizations/${TEST_ORG}/sessions`), ({ request }) => {
        const week = new URL(request.url).searchParams.get('weekStart');
        if (week !== nextWeekStart) return HttpResponse.json({ data: [] });
        // A class on the first day of next week — the day the strip lands
        // on once the selection can no longer be today.
        const startsAt = new Date(`${nextWeekStart}T09:00:00`);
        return HttpResponse.json({
          data: [
            classSession({
              id: 'sess_next',
              classType: {
                id: 'ct_2',
                name: 'Next Week Ride',
                color: null,
                defaultDurationMin: 45,
              },
              startsAt: startsAt.toISOString(),
              endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
            }),
          ],
        });
      }),
      http.get(api(`/organizations/${TEST_ORG}/announcements/unread-count`), () =>
        HttpResponse.json({ data: { count: 0 } }),
      ),
      http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
        HttpResponse.json({ data: { conversations: [] } }),
      ),
    );

    await renderWithProviders(<ScheduleScreen />);
    await waitFor(() =>
      expect(screen.getByText(S.noClassesToday)).toBeOnTheScreen(),
    );

    await userEvent.press(screen.getByRole('button', { name: S.nextWeek }));

    expect(await screen.findByText('Next Week Ride')).toBeOnTheScreen();
    expect(screen.queryByText(S.noClassesToday)).not.toBeOnTheScreen();
  });
});
