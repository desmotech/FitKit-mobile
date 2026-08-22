/**
 * In-app QR scanner (app/(tabs)/schedule/scan.tsx) — pins what the member
 * sees around the camera: a denied permission shows the settings copy
 * (never a dead black screen), a valid gym QR posts the exact self-checkin
 * payload and celebrates before returning, and an unparseable QR shows the
 * invalid-code error without ever posting.
 *
 * expo-camera is mocked locally (the one native edge this screen has):
 * `mockPermission` drives useCameraPermissions and the CameraView stub
 * exposes its `onBarcodeScanned` prop so tests can "scan" a code.
 */
import { dictionaries } from '@taikan/shared';
import { act, screen, waitFor } from '@testing-library/react-native';
import ScanScreen from '../(tabs)/schedule/scan';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const heDict = dictionaries.he as unknown as {
  schedule: { scanner: Record<string, string> };
};
const SC = heDict.schedule.scanner;

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

let mockPermission: {
  granted: boolean;
  canAskAgain: boolean;
} | null = null;
const mockRequestPermission = jest.fn();
let mockScan: ((event: { data: string }) => void) | undefined;

jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (e: { data: string }) => void }) => {
    mockScan = props.onBarcodeScanned;
    return null;
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));

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

/** Render the scanner and wait until the member's org has resolved — a
 *  real member can't physically scan before the screen has loaded. */
async function renderReadyScanner() {
  const { queryClient } = await renderWithProviders(<ScanScreen />);
  await waitFor(() =>
    expect(queryClient.getQueryData(['/users/me'])).toBeTruthy(),
  );
  // The cache having data doesn't mean the screen re-rendered with the
  // resolved orgId yet (react-query batches notifications on a macrotask).
  // Flush one so the scan handler closes over the real org — otherwise the
  // check-in posts to /organizations/undefined/… and flakes.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(mockScan).toBeDefined());
}

async function scan(data: string) {
  await act(async () => {
    mockScan?.({ data });
  });
}

beforeEach(() => {
  mockRouterBack.mockClear();
  mockRequestPermission.mockClear();
  mockScan = undefined;
  mockPermission = { granted: true, canAskAgain: false };
  stageSignedInMember();
});

describe('QR scanner', () => {
  it('explains why the camera is needed and points at Settings when access was denied for good', async () => {
    mockPermission = { granted: false, canAskAgain: false };

    await renderWithProviders(<ScanScreen />);

    expect(await screen.findByText(SC.cameraNeeded)).toBeOnTheScreen();
    expect(screen.getByText(SC.cameraDesc)).toBeOnTheScreen();
    // Can't re-prompt — the button routes to Settings instead.
    expect(screen.getByText(SC.openSettings)).toBeOnTheScreen();
  });

  it('checks the member in from a valid taikan:// QR and returns to Schedule', async () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    const bodies = captureCheckin('sess_1');
    await renderReadyScanner();

    await scan(
      `taikan://checkin?org=${TEST_ORG}&s=sess_1&t=tok_scan_1&e=${exp}`,
    );

    await waitFor(() => expect(bodies).toHaveLength(1), { timeout: 4000 });
    expect(
      await screen.findByText(SC.success, {}, { timeout: 4000 }),
    ).toBeOnTheScreen();
    expect(bodies[0]).toEqual({
      method: 'qr',
      token: 'tok_scan_1',
      expiresAt: exp,
    });
    // Brief celebration, then back to the schedule the scanner came from.
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled(), {
      timeout: 3000,
    });
  });

  it('rejects a QR without the check-in params — invalid-code error, no post', async () => {
    const bodies = captureCheckin('sess_1');
    await renderReadyScanner();

    await scan('taikan://checkin'); // parseable URL, but not a gym code

    expect(await screen.findByText(SC.invalidQr)).toBeOnTheScreen();
    expect(bodies).toHaveLength(0);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('rejects a non-URL scan — unreadable error, no post', async () => {
    const bodies = captureCheckin('sess_1');
    await renderReadyScanner();

    await scan('just some text, not a URL');

    expect(await screen.findByText(SC.unreadable)).toBeOnTheScreen();
    expect(bodies).toHaveLength(0);
  });
});
