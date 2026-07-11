/**
 * Workout result logging — the primary "record what I did" action. These
 * tests pin the payload contract the API depends on: score serialization,
 * local-noon performedAt anchoring, assignment forking, and the rx/scaled
 * flags (including the documented "Modified can't persist yet" limitation).
 *
 * Network staged via MSW; the member drives the real screen.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import LogWorkoutResultScreen from '../log/workout/[id]';
import { logStringsFor } from '@/i18n/log-strings';
import { ymd, ymdToInstantISO } from '@/lib/week';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const L = logStringsFor('he');

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'asg_1' }),
}));

function assignmentDay(workoutOverrides: Record<string, unknown> = {}) {
  return {
    id: 'asg_1',
    date: '2026-07-10',
    published: true,
    kind: 'workout',
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
      ...workoutOverrides,
    },
  };
}

function stageWorkout(day = assignmentDay()) {
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/assignments/asg_1`), () =>
      HttpResponse.json({ data: day }),
    ),
    http.get(
      api(`/organizations/${TEST_ORG}/workouts/w_1/results/me/latest`),
      () => HttpResponse.json({ data: null }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/personal-records/me`), () =>
      HttpResponse.json({ data: [] }),
    ),
  );
}

function capturePost() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      api(`/organizations/${TEST_ORG}/workouts/w_1/results`),
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { id: 'res_1' } });
      },
    ),
  );
  return bodies;
}

// The score fields carry the same a11y label on the visible caption and the
// input; pick the editable element.
function scoreField(label: string) {
  const input = screen
    .getAllByLabelText(label)
    .find((el) => el.type === 'TextInput');
  if (!input) throw new Error(`No TextInput labelled ${label}`);
  return input;
}

async function enterTime(minutes: string, seconds: string) {
  await userEvent.type(scoreField(L.scoreMin), minutes);
  await userEvent.type(scoreField(L.scoreSec), seconds);
}

beforeEach(() => {
  mockRouterBack.mockClear();
  stageSignedInMember();
});

describe('logging a workout result', () => {
  it('shows the workout and keeps Save disabled until something is logged', async () => {
    stageWorkout();
    await renderWithProviders(<LogWorkoutResultScreen />);

    expect(await screen.findByText('Fran')).toBeOnTheScreen();
    const save = screen.getByRole('button', { name: L.workoutSave });
    expect(save).toBeDisabled();

    await enterTime('3', '45');
    expect(save).toBeEnabled();
  });

  it('saves the exact payload the API contract expects and returns the member', async () => {
    stageWorkout();
    const bodies = capturePost();
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    await enterTime('3', '45');
    await userEvent.press(screen.getByRole('button', { name: L.workoutSave }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      scoreValue: '03:45',
      // Anchored at local noon of the picked day so no timezone renders the
      // workout on a neighboring calendar day.
      performedAt: ymdToInstantISO(ymd(new Date())),
      // Anchors the result to the assignment so the server forks a snapshot.
      assignmentId: 'asg_1',
    });
    // Nothing was selected/typed for these — they must be absent, not false/"".
    expect(bodies[0]).not.toHaveProperty('rx');
    expect(bodies[0]).not.toHaveProperty('scaled');
    expect(bodies[0]).not.toHaveProperty('setResults');
    expect(bodies[0]).not.toHaveProperty('notes');
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('sends rx: true when the member marks the workout Rx', async () => {
    stageWorkout();
    const bodies = capturePost();
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    await enterTime('3', '45');
    await userEvent.press(screen.getByRole('radio', { name: L.perfRx }));
    await userEvent.press(screen.getByRole('button', { name: L.workoutSave }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ rx: true });
    expect(bodies[0]).not.toHaveProperty('scaled');
  });

  it('sends neither flag for a Modified selection (API cannot persist it yet)', async () => {
    stageWorkout();
    const bodies = capturePost();
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    await enterTime('3', '45');
    await userEvent.press(screen.getByRole('radio', { name: L.perfModified }));
    await userEvent.press(screen.getByRole('button', { name: L.workoutSave }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    // Documented limitation: DTO has no `modified` field; sending an unknown
    // field could fail validation. Selection is captured in analytics only.
    expect(bodies[0]).not.toHaveProperty('rx');
    expect(bodies[0]).not.toHaveProperty('scaled');
    expect(bodies[0]).not.toHaveProperty('modified');
  });

  it('tells the member when saving fails and stays on the screen', async () => {
    stageWorkout();
    server.use(
      http.post(api(`/organizations/${TEST_ORG}/workouts/w_1/results`), () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    await enterTime('3', '45');
    await userEvent.press(screen.getByRole('button', { name: L.workoutSave }));

    // Banner appends the server message: "<failed copy> — nope".
    expect(
      await screen.findByText(new RegExp(L.workoutFailed)),
    ).toBeOnTheScreen();
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('logs prescription-seeded sets when the member confirms them', async () => {
    stageWorkout(
      assignmentDay({
        scoring: 'none',
        sections: [
          {
            id: 'sec_1',
            type: 'strength',
            title: 'Back Squat',
            description: null,
            sortOrder: 0,
            shape: null,
            config: null,
            movements: [
              {
                id: 'wm_1',
                exercise: { id: 'ex_squat', name: 'Back Squat' },
                prescribedSets: 2,
                prescribedReps: '5',
                prescribedWeight: null,
                prescribedDistance: null,
                prescribedDuration: null,
                notes: null,
                prescription: null,
              },
            ],
          },
        ],
      }),
    );
    const bodies = capturePost();
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    // Confirm only set 1 of 2 — untouched prefilled rows must NOT be sent
    // (they'd fabricate sets the member never did).
    await userEvent.press(
      await screen.findByRole('button', { name: L.a11ySetMarkDone(1) }),
    );
    await userEvent.press(screen.getByRole('button', { name: L.workoutSave }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].setResults).toEqual([
      {
        workoutMovementId: 'wm_1',
        exerciseId: 'ex_squat',
        setNumber: 1,
        reps: 5,
      },
    ]);
  });

  it('lets a "none"-scored workout save immediately (nothing to score)', async () => {
    stageWorkout(assignmentDay({ scoring: 'none' }));
    const bodies = capturePost();
    await renderWithProviders(<LogWorkoutResultScreen />);
    await screen.findByText('Fran');

    const save = screen.getByRole('button', { name: L.workoutSave });
    expect(save).toBeEnabled();
    await userEvent.press(save);

    await waitFor(() => expect(bodies).toHaveLength(1));
    // No fabricated "0" score — empty string stores NULL server-side.
    expect(bodies[0]).toMatchObject({ scoreValue: '' });
  });
});
