/**
 * Free-form lift logger — pins the manual-PR payload contract
 * (exerciseId + serialized value/unit + local-noon achievedAt), the
 * recents-chip pick path (derived from the member's PR history), the
 * celebration on success, and the inline failure copy on error.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import LogLiftScreen from '../log/lift';
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
}));

const PRS_PATH = `/organizations/${TEST_ORG}/personal-records/me`;

/** One prior PR → 'Back Squat' shows up as a recents chip. */
function stageRecents() {
  server.use(
    http.get(api(PRS_PATH), () =>
      HttpResponse.json({
        data: [
          {
            id: 'pr_1',
            exerciseId: 'ex_bs',
            exerciseName: 'Back Squat',
            value: '100',
            unit: 'kg',
            repScheme: null,
            achievedAt: '2026-07-01T10:00:00.000Z',
          },
        ],
      }),
    ),
  );
}

function capturePost() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(api(PRS_PATH), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ data: { id: 'pr_new' } });
    }),
  );
  return bodies;
}

// The weight field caption could share the input's label; pick the editable one.
function weightField() {
  const input = screen
    .getAllByLabelText(L.setColWeight)
    .find((el) => el.type === 'TextInput');
  if (!input) throw new Error(`No TextInput labelled ${L.setColWeight}`);
  return input;
}

function saveButton() {
  return screen.getByRole('button', { name: L.workoutSave });
}

async function pickRecentAndEnterWeight(weight: string) {
  await userEvent.press(
    await screen.findByRole('button', { name: 'Back Squat' }),
  );
  await userEvent.type(weightField(), weight);
}

beforeEach(() => {
  mockRouterBack.mockClear();
  stageSignedInMember();
  stageRecents();
});

describe('logging a lift PR', () => {
  it('enables Save only after picking a recent exercise and entering a weight', async () => {
    await renderWithProviders(<LogLiftScreen />);

    // Nothing picked yet → disabled.
    expect(await screen.findByText(L.liftTitle)).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();

    // Picking the exercise alone isn't enough — a weight is still required.
    await userEvent.press(
      await screen.findByRole('button', { name: 'Back Squat' }),
    );
    expect(saveButton()).toBeDisabled();

    await userEvent.type(weightField(), '105');
    expect(saveButton()).toBeEnabled();
  });

  it('POSTs the PR payload and celebrates with the new record', async () => {
    const bodies = capturePost();
    await renderWithProviders(<LogLiftScreen />);

    await pickRecentAndEnterWeight('105');
    await userEvent.press(saveButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      exerciseId: 'ex_bs',
      value: '105',
      unit: 'kg',
      // Local-noon anchoring keeps the picked day stable across timezones.
      achievedAt: ymdToInstantISO(ymd(new Date())),
    });

    // PRCelebration: title, big summary, exercise name, description.
    expect(await screen.findByText(L.liftPrTitle)).toBeOnTheScreen();
    expect(screen.getByText('105 kg')).toBeOnTheScreen();
    expect(screen.getByText('Back Squat')).toBeOnTheScreen();
    expect(screen.getByText(L.liftPrSubtitle)).toBeOnTheScreen();
  });

  it('dismisses the celebration back to the previous screen via the CTA', async () => {
    capturePost();
    await renderWithProviders(<LogLiftScreen />);

    await pickRecentAndEnterWeight('105');
    await userEvent.press(saveButton());
    await screen.findByText(L.liftPrTitle);

    // The whole card and the explicit CTA share the Done label; either exit works.
    await userEvent.press(
      screen.getAllByRole('button', { name: L.prCtaDone })[0],
    );
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('shows the failure copy and no celebration when the save fails', async () => {
    server.use(
      http.post(api(PRS_PATH), () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    await renderWithProviders(<LogLiftScreen />);

    await pickRecentAndEnterWeight('105');
    await userEvent.press(saveButton());

    expect(await screen.findByText(L.liftFailed)).toBeOnTheScreen();
    expect(screen.queryByText(L.liftPrTitle)).not.toBeOnTheScreen();
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
