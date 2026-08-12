/**
 * Deep-link QR check-in (app/checkin.tsx) — pins the contract of the
 * auto-fired self-checkin: valid link params POST `{ method: 'qr', token,
 * expiresAt }` to the QR's org and show the success state; a malformed or
 * expired link shows its specific error copy WITHOUT ever posting; a server
 * rejection surfaces its message with the back-to-schedule affordance.
 *
 * Copy comes from the shared `schedule.checkinPage` dictionary — the same
 * table the web QR landing renders, so the surfaces stay in sync.
 */
import { dictionaries } from '@fitkit/shared';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import CheckInScreen from '../checkin';
import { scheduleStringsFor } from '@/i18n/schedule-strings';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const heDict = dictionaries.he as unknown as {
  schedule: { checkinPage: Record<string, string> };
};
const C = heDict.schedule.checkinPage;
// The refusal title/body are the app's own softer copy, NOT the shared
// console dictionary's "הצ׳ק-אין נכשל" — see schedule-strings.ts.
const S = scheduleStringsFor('he');

const mockRouterReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockSearchParams,
  Redirect: jest.fn(() => null),
}));

/** Capture (or fail) the self-checkin POST for the given session. */
function captureCheckin(
  sessionId: string,
  respond: () => Response = () =>
    HttpResponse.json({ data: { checkedIn: true } }),
) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      api(`/organizations/${TEST_ORG}/sessions/${sessionId}/self-checkin`),
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return respond();
      },
    ),
  );
  return bodies;
}

const FUTURE_EXP = () => Math.floor(Date.now() / 1000) + 900;

beforeEach(() => {
  mockRouterReplace.mockClear();
  mockSearchParams = {};
  stageSignedInMember();
});

describe('QR deep-link check-in', () => {
  it('auto-fires the self-checkin with the exact QR payload and celebrates, then lands on Schedule', async () => {
    const exp = FUTURE_EXP();
    mockSearchParams = {
      org: TEST_ORG,
      s: 'sess_1',
      t: 'tok_qr_1',
      e: String(exp),
    };
    const bodies = captureCheckin('sess_1');

    await renderWithProviders(<CheckInScreen />);

    expect(await screen.findByText(C.success)).toBeOnTheScreen();
    expect(screen.getByText(C.successDesc)).toBeOnTheScreen();
    expect(bodies).toHaveLength(1);
    // The exact wire contract — token + unix-seconds expiry from the QR.
    expect(bodies[0]).toEqual({
      method: 'qr',
      token: 'tok_qr_1',
      expiresAt: exp,
    });
    // The brief celebration auto-navigates to the fresh schedule.
    await waitFor(
      () => expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/schedule'),
      { timeout: 3000 },
    );
  });

  it('shows the invalid-link error for a link missing its token params — and never posts', async () => {
    mockSearchParams = { org: TEST_ORG }; // no s / t / e
    const bodies = captureCheckin('sess_1');

    await renderWithProviders(<CheckInScreen />);

    expect(await screen.findByText(S.checkInRefusedTitle)).toBeOnTheScreen();
    expect(screen.getByText(C.invalidLink)).toBeOnTheScreen();
    expect(bodies).toHaveLength(0);
  });

  it('shows the expired-link error when the QR expiry has passed — and never posts', async () => {
    mockSearchParams = {
      org: TEST_ORG,
      s: 'sess_1',
      t: 'tok_qr_1',
      e: String(Math.floor(Date.now() / 1000) - 60),
    };
    const bodies = captureCheckin('sess_1');

    await renderWithProviders(<CheckInScreen />);

    expect(await screen.findByText(S.checkInRefusedTitle)).toBeOnTheScreen();
    expect(screen.getByText(C.expired)).toBeOnTheScreen();
    expect(bodies).toHaveLength(0);
  });

  it("surfaces the server's rejection with a way back to the schedule", async () => {
    mockSearchParams = {
      org: TEST_ORG,
      s: 'sess_1',
      t: 'tok_qr_1',
      e: String(FUTURE_EXP()),
    };
    captureCheckin('sess_1', () =>
      HttpResponse.json({ message: 'Session not found' }, { status: 404 }),
    );

    await renderWithProviders(<CheckInScreen />);

    expect(await screen.findByText(S.checkInRefusedTitle)).toBeOnTheScreen();
    // The API's own wording never reaches the member: it is raw English here,
    // and the staff console's "הצ׳ק-אין נכשל" when the API does localize.
    // A refusal on this screen is a rule (too early, wrong place, no
    // booking), so the member gets copy that says where to look instead.
    expect(screen.queryByText('Session not found')).not.toBeOnTheScreen();
    expect(screen.getByText(S.checkInRefusedBody)).toBeOnTheScreen();
    expect(screen.queryByText(C.success)).not.toBeOnTheScreen();

    await userEvent.press(
      screen.getByRole('button', { name: C.backToSchedule }),
    );
    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/schedule');
  });
});
