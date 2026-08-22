/**
 * Workout detail — the program-sheet screen a member opens from the
 * Whiteboard, Home, or a deep link. These tests pin the member-visible
 * contract: the staged assignment renders its name and movements, the
 * complete/uncomplete round-trip hits the right endpoints and flips the
 * CTA cluster, rest/note assignments render their minimal detail instead
 * of crashing, and a failed fetch shows the load-error state (never the
 * "workout isn't here" copy).
 *
 * Network staged via MSW; the member drives the real screen.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import WorkoutDetailScreen from '../(tabs)/workouts/[id]/index';
import { programSheetStringsFor } from '@/i18n/program-sheet-strings';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const PS = programSheetStringsFor('he');
// Rest/note copy and the error states come from the shared dictionary —
// the same table the screen reads at runtime.
const DICT = dictionaries.he as unknown as {
  program: Record<string, string>;
  workout: {
    notFound: Record<string, string>;
    loadError: Record<string, string>;
  };
};

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: mockRouterPush,
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'asg_1' }),
}));

function strengthSection() {
  return {
    id: 'sec_1',
    type: 'strength',
    title: null,
    description: null,
    sortOrder: 0,
    shape: null,
    config: null,
    movements: [
      {
        id: 'wm_1',
        sortOrder: 0,
        exercise: { id: 'ex_squat', name: 'Back Squat', category: 'strength' },
        prescribedSets: 3,
        prescribedReps: '5',
        prescribedWeight: null,
        prescribedDistance: null,
        prescribedDuration: null,
        notes: null,
        prescription: null,
      },
    ],
  };
}

function assignmentDay(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asg_1',
    date: '2026-07-10',
    published: true,
    status: 'assigned',
    kind: 'workout',
    completedAt: null,
    workout: {
      id: 'w_1',
      title: 'Fran',
      displayName: 'Fran',
      description: null,
      scoring: 'time',
      mode: 'fixed',
      timeCap: null,
      sortOrder: 0,
      sections: [],
    },
    ...overrides,
  };
}

/**
 * Stage every read the detail screen fires on mount. The assignment
 * handler serves from mutable `state` so complete/uncomplete tests can
 * flip what the post-invalidation refetch returns.
 */
function stageDetail(initial: Record<string, unknown> = assignmentDay()) {
  const state = { day: initial };
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/assignments/asg_1`), () =>
      HttpResponse.json({ data: state.day }),
    ),
    // Header chat button's unread badge thread.
    http.get(
      api(`/organizations/${TEST_ORG}/workout-assignments/asg_1/comments`),
      () =>
        HttpResponse.json({
          data: { messages: [], nextCursor: null, hasMore: false },
        }),
    ),
    // "Last · …" footer + History list.
    http.get(api(`/organizations/${TEST_ORG}/results/me`), () =>
      HttpResponse.json({ data: [] }),
    ),
  );
  return state;
}

// Flake guard: a resolved cache doesn't guarantee the screen re-rendered
// over the new data — flush a macrotask before acting on it.
async function flushRender() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  mockRouterBack.mockClear();
  mockRouterPush.mockClear();
  stageSignedInMember();
});

describe('Workout detail — content', () => {
  it('renders the workout name and its section movements', async () => {
    stageDetail(
      assignmentDay({
        workout: {
          ...(assignmentDay().workout as Record<string, unknown>),
          sections: [strengthSection()],
        },
      }),
    );

    await renderWithProviders(<WorkoutDetailScreen />);

    expect(await screen.findByText('Fran')).toBeOnTheScreen();
    expect(await screen.findByText('Back Squat')).toBeOnTheScreen();
    // An open assignment offers the complete CTA, not the done state.
    expect(
      screen.getByRole('button', { name: PS.markCompleted }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(PS.completed)).not.toBeOnTheScreen();
  });
});

describe('Workout detail — completion round-trip', () => {
  it('POSTs to …/complete and flips the CTA to the done state', async () => {
    const state = stageDetail();
    const completeUrls: string[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/assignments/asg_1/complete`),
        ({ request }) => {
          completeUrls.push(request.url);
          state.day = assignmentDay({
            status: 'completed',
            completedAt: '2026-07-10T09:30:00.000Z',
          });
          return HttpResponse.json({ data: state.day });
        },
      ),
    );
    await renderWithProviders(<WorkoutDetailScreen />);
    await screen.findByText('Fran');
    await flushRender();

    await userEvent.press(
      screen.getByRole('button', { name: PS.markCompleted }),
    );

    await waitFor(() => expect(completeUrls).toHaveLength(1));
    expect(completeUrls[0]).toBe(
      api(`/organizations/${TEST_ORG}/assignments/asg_1/complete`),
    );
    // Done state: static "Completed" confirmation with an Undo affordance.
    expect(await screen.findByText(PS.completed)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: PS.undo })).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: PS.markCompleted }),
      ).not.toBeOnTheScreen(),
    );
  });

  it('offers Undo on a completed assignment and POSTs to …/uncomplete', async () => {
    const state = stageDetail(
      assignmentDay({
        status: 'completed',
        completedAt: '2026-07-10T09:30:00.000Z',
      }),
    );
    const uncompleteUrls: string[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/assignments/asg_1/uncomplete`),
        ({ request }) => {
          uncompleteUrls.push(request.url);
          state.day = assignmentDay();
          return HttpResponse.json({ data: state.day });
        },
      ),
    );
    await renderWithProviders(<WorkoutDetailScreen />);

    expect(await screen.findByText(PS.completed)).toBeOnTheScreen();
    await flushRender();

    await userEvent.press(screen.getByRole('button', { name: PS.undo }));

    await waitFor(() => expect(uncompleteUrls).toHaveLength(1));
    expect(uncompleteUrls[0]).toBe(
      api(`/organizations/${TEST_ORG}/assignments/asg_1/uncomplete`),
    );
    // Back to the open state after the refetch.
    expect(
      await screen.findByRole('button', { name: PS.markCompleted }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText(PS.completed)).not.toBeOnTheScreen(),
    );
  });
});

describe('Workout detail — rest / note assignments', () => {
  it('renders a rest-day assignment with the rest copy and no workout CTAs', async () => {
    stageDetail(assignmentDay({ kind: 'rest', workout: null }));

    await renderWithProviders(<WorkoutDetailScreen />);

    expect(
      await screen.findByText(DICT.program.restDayTitle),
    ).toBeOnTheScreen();
    expect(screen.getByText(DICT.program.restDaySubtitle)).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: PS.markCompleted }),
    ).not.toBeOnTheScreen();
  });

  it('renders a note assignment with the coach-note title and its body', async () => {
    stageDetail(
      assignmentDay({
        kind: 'note',
        workout: null,
        note: 'שתו הרבה מים לפני האימון',
      }),
    );

    await renderWithProviders(<WorkoutDetailScreen />);

    expect(
      await screen.findByText(DICT.program.coachNoteTitle),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('שתו הרבה מים לפני האימון'),
    ).toBeOnTheScreen();
  });
});

describe('Workout detail — load failure', () => {
  it('shows the load-error state with retry — never the not-found copy', async () => {
    stageDetail();
    server.use(
      // 401: fails fast by design (useApiQuery skips retries for it), so
      // the error state appears without waiting out the retry backoff.
      http.get(api(`/organizations/${TEST_ORG}/assignments/asg_1`), () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );

    await renderWithProviders(<WorkoutDetailScreen />);

    expect(
      await screen.findByText(DICT.workout.loadError.title),
    ).toBeOnTheScreen();
    expect(screen.getByText(DICT.workout.loadError.body)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: DICT.workout.loadError.retry }),
    ).toBeOnTheScreen();
    // A recoverable failure must not read as "this workout was removed".
    expect(
      screen.queryByText(DICT.workout.notFound.title),
    ).not.toBeOnTheScreen();
  });
});
