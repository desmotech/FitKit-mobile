/**
 * Body-metric quick log — pins the payload contract of the self-report
 * endpoint: numeric value, per-type default unit, local-noon recordedAt
 * anchoring, and the ?type= prefill. Save must stay disabled until a
 * positive numeric value is entered, and a failed save must keep the
 * member on the screen with the failure copy.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import LogMetricScreen from '../log/metric';
import { logStringsFor } from '@/i18n/log-strings';
import { ymd, ymdToInstantISO } from '@/lib/week';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const L = logStringsFor('he');

const mockRouterBack = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

function capturePost() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      api(`/organizations/${TEST_ORG}/metrics/me`),
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { id: 'bm_1' } });
      },
    ),
  );
  return bodies;
}

// The value caption and its input could share a label; pick the editable one.
function valueField() {
  const input = screen
    .getAllByLabelText(L.metricValue)
    .find((el) => el.type === 'TextInput');
  if (!input) throw new Error(`No TextInput labelled ${L.metricValue}`);
  return input;
}

function saveButton() {
  return screen.getByRole('button', { name: L.workoutSave });
}

beforeEach(() => {
  mockRouterBack.mockClear();
  mockSearchParams = {};
  stageSignedInMember();
});

describe('logging a body metric', () => {
  it('keeps Save disabled until a positive numeric value is entered', async () => {
    await renderWithProviders(<LogMetricScreen />);

    expect(await screen.findByText(L.metricTitle)).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();

    // Zero is not a plausible measurement — still disabled.
    await userEvent.type(valueField(), '0');
    expect(saveButton()).toBeDisabled();

    await userEvent.clear(valueField());
    await userEvent.type(valueField(), '75.5');
    expect(saveButton()).toBeEnabled();
  });

  it('POSTs the value with the default type/unit, anchored at local noon, then returns the member', async () => {
    const bodies = capturePost();
    await renderWithProviders(<LogMetricScreen />);

    await userEvent.type(valueField(), '75.5');
    await userEvent.press(saveButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      metricType: 'weight',
      value: 75.5,
      unit: 'kg',
      // Local-noon anchoring keeps the picked day stable across timezones.
      recordedAt: ymdToInstantISO(ymd(new Date())),
    });
    // No notes typed → the field must be absent, not "".
    expect(bodies[0]).not.toHaveProperty('notes');
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('pre-selects the metric type (and its default unit) from the ?type= param', async () => {
    mockSearchParams = { type: 'waist' };
    const bodies = capturePost();
    await renderWithProviders(<LogMetricScreen />);

    await userEvent.type(valueField(), '82');
    await userEvent.press(saveButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      metricType: 'waist',
      value: 82,
      unit: 'cm',
    });
  });

  it('shows the failure copy and stays on the screen when the save fails', async () => {
    server.use(
      http.post(api(`/organizations/${TEST_ORG}/metrics/me`), () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    await renderWithProviders(<LogMetricScreen />);

    await userEvent.type(valueField(), '75');
    await userEvent.press(saveButton());

    expect(await screen.findByText(L.metricFailed)).toBeOnTheScreen();
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
