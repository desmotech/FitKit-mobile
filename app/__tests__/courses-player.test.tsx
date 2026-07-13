/**
 * Course player — the day-by-day screen behind a library card. Pins the
 * member-visible contract: today's workouts render for a started course,
 * the not-started state offers Start (and POSTs it), restart demands a
 * native confirm before its destructive POST, day paging reaches the rest
 * state, meetings book against the RSVP endpoint (full meetings can't),
 * materials render, and the payment-pending race shows its own copy.
 *
 * Network staged via MSW; the member drives the real screen.
 */
import {
  act,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import CoursePlayerScreen from '../(tabs)/courses/[id]/index';
import { coursesStringsFor } from '@/i18n/courses-strings';
import {
  courseEntitlement,
  courseSession,
  stageSignedInMember,
} from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';

const CS = coursesStringsFor('he');
const COURSE = 'prog_course_1';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'prog_course_1' }),
}));

/** Serves `/me/courses/:id` from mutable state so mutations can flip it. */
function stagePlayer(initial = courseEntitlement()) {
  const state = { entitlement: initial };
  server.use(
    http.get(api(`/me/courses/${COURSE}`), () =>
      HttpResponse.json({ data: state.entitlement }),
    ),
    // Tab layout / other screens' caches are irrelevant here, but the
    // mutations invalidate the whole `/me/courses` prefix — stage the list
    // read too so the refetch never trips the unhandled-request guard.
    http.get(api('/me/courses'), () =>
      HttpResponse.json({ data: [state.entitlement] }),
    ),
  );
  return state;
}

async function flushRender() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  mockRouterPush.mockClear();
  stageSignedInMember();
});

describe('Course player — started course', () => {
  it("renders today's workout, the day progress line, and the seller-org name", async () => {
    stagePlayer();

    await renderWithProviders(<CoursePlayerScreen />);

    expect(await screen.findByText('Foundations A')).toBeOnTheScreen();
    expect(
      screen.getByText(
        CS.dayProgress.replace('{n}', '1').replace('{total}', '2'),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Test Gym')).toBeOnTheScreen();
    // Started course: no Start CTA.
    expect(
      screen.queryByRole('button', { name: CS.startCta }),
    ).not.toBeOnTheScreen();
  });

  it('opens the workout view for the tapped workout', async () => {
    stagePlayer();
    await renderWithProviders(<CoursePlayerScreen />);
    await screen.findByText('Foundations A');
    await flushRender();

    await userEvent.press(
      screen.getByRole('button', { name: 'Foundations A' }),
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/courses/[id]/workout/[workoutId]',
      params: { id: COURSE, workoutId: 'w_course_1' },
    });
  });

  it('pages to the next day and renders the rest state', async () => {
    stagePlayer();
    await renderWithProviders(<CoursePlayerScreen />);
    await screen.findByText('Foundations A');
    await flushRender();

    // The "next day" pager chevron is labelled with the target day.
    await userEvent.press(
      screen.getAllByRole('button', {
        name: CS.dayLabel.replace('{n}', '2'),
      })[0],
    );

    expect(await screen.findByText(CS.restDayTitle)).toBeOnTheScreen();
    expect(screen.getByText(CS.restDaySubtitle)).toBeOnTheScreen();
  });
});

describe('Course player — start', () => {
  it('offers Start before a start date exists and POSTs …/start', async () => {
    const state = stagePlayer(courseEntitlement({ startDate: null }));
    const startUrls: string[] = [];
    server.use(
      http.post(api(`/me/courses/${COURSE}/start`), ({ request }) => {
        startUrls.push(request.url);
        state.entitlement = courseEntitlement();
        return HttpResponse.json({ data: state.entitlement });
      }),
    );
    await renderWithProviders(<CoursePlayerScreen />);

    await userEvent.press(
      await screen.findByRole('button', { name: CS.startCta }),
    );

    await waitFor(() => expect(startUrls).toHaveLength(1));
    // Post-invalidation refetch drops the Start card.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: CS.startCta }),
      ).not.toBeOnTheScreen(),
    );
  });
});

describe('Course player — restart', () => {
  it('confirms via a destructive Alert before POSTing …/restart', async () => {
    stagePlayer();
    const restartUrls: string[] = [];
    server.use(
      http.post(api(`/me/courses/${COURSE}/restart`), ({ request }) => {
        restartUrls.push(request.url);
        return HttpResponse.json({ data: courseEntitlement() });
      }),
    );
    const alertSpy = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<CoursePlayerScreen />);
    await screen.findByText('Foundations A');
    await flushRender();

    await userEvent.press(screen.getByRole('button', { name: CS.restart }));

    // Nothing fires until the member confirms.
    expect(alertSpy).toHaveBeenCalledWith(
      CS.restartConfirmTitle,
      CS.restartConfirmBody,
      expect.anything(),
    );
    expect(restartUrls).toHaveLength(0);

    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    await act(async () => {
      confirm?.onPress?.();
    });

    await waitFor(() => expect(restartUrls).toHaveLength(1));
    alertSpy.mockRestore();
  });
});

describe('Course player — meetings', () => {
  it('renders an upcoming meeting with spots left and books via the RSVP endpoint', async () => {
    const state = stagePlayer(
      courseEntitlement({ sessions: [courseSession()] }),
    );
    const rsvpUrls: string[] = [];
    server.use(
      http.post(
        api(`/me/courses/${COURSE}/sessions/cs_1/rsvp`),
        ({ request }) => {
          rsvpUrls.push(request.url);
          state.entitlement = courseEntitlement({
            sessions: [
              courseSession({ myRsvpStatus: 'booked', bookedCount: 4 }),
            ],
          });
          return HttpResponse.json({ data: {} });
        },
      ),
    );
    await renderWithProviders(<CoursePlayerScreen />);

    expect(await screen.findByText('Kickoff meetup')).toBeOnTheScreen();
    expect(
      screen.getByText(CS.spotsLeft.replace('{n}', '7')),
    ).toBeOnTheScreen();
    await flushRender();

    await userEvent.press(screen.getByRole('button', { name: CS.bookCta }));

    await waitFor(() => expect(rsvpUrls).toHaveLength(1));
    // Refetched state: booked badge + cancel affordance.
    expect(await screen.findByText(CS.bookedBadge)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: CS.cancelBookingCta }),
    ).toBeOnTheScreen();
  });

  it('disables booking on a full meeting', async () => {
    stagePlayer(
      courseEntitlement({
        sessions: [courseSession({ capacity: 3, bookedCount: 3 })],
      }),
    );
    await renderWithProviders(<CoursePlayerScreen />);

    const fullBtn = await screen.findByRole('button', {
      name: CS.meetingFullCta,
    });
    expect(fullBtn).toBeOnTheScreen();
    expect(fullBtn).toBeDisabled();
  });
});

describe('Course player — materials', () => {
  it('renders course-wide materials under the materials heading', async () => {
    stagePlayer(
      courseEntitlement({
        materials: [
          {
            id: 'mat_1',
            programId: COURSE,
            dayOffset: null,
            kind: 'link',
            title: 'Nutrition guide',
            description: null,
            url: 'https://example.com/guide',
            fileName: null,
            mimeType: null,
            sizeBytes: null,
            sortOrder: 0,
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      }),
    );

    await renderWithProviders(<CoursePlayerScreen />);

    expect(await screen.findByText(CS.materialsHeading)).toBeOnTheScreen();
    expect(screen.getByText('Nutrition guide')).toBeOnTheScreen();
  });
});

describe('Course player — payment pending', () => {
  it('shows the processing copy while the checkout webhook races the buyer here', async () => {
    server.use(
      // The screen matches on the message; 401 status keeps the test fast
      // (useApiQuery retries every other status three times with backoff).
      http.get(api(`/me/courses/${COURSE}`), () =>
        HttpResponse.json(
          { message: 'Payment is still being processed' },
          { status: 401 },
        ),
      ),
    );

    await renderWithProviders(<CoursePlayerScreen />);

    expect(await screen.findByText(CS.paymentPendingTitle)).toBeOnTheScreen();
    expect(screen.getByText(CS.paymentPendingBody)).toBeOnTheScreen();
  });
});
