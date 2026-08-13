/**
 * App-icon badge sync.
 *
 * The bug these pin (prod, 2026-08-13): a push stamps the OS badge while the
 * app is backgrounded, the member reads the message elsewhere, and on resume
 * the server returns the *same* count the cache already held. The render
 * effect is keyed on that count, so React sees no change and never re-writes
 * the icon — leaving the push's number on the home screen indefinitely. Cold
 * start cleared it (fresh mount, `undefined → n`); resume never did.
 *
 * So the guarantee is: **every resume writes the icon**, whether or not the
 * number moved.
 */
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { useAppIconBadge } from '../use-badge';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { makeTestQueryClient, TEST_ORG } from '../../../test/render';

const BADGE_PATH = api(`/organizations/${TEST_ORG}/badge`);
const FORMS_PATH = api(`/organizations/${TEST_ORG}/forms/mine`);

const setBadgeCountAsync = Notifications.setBadgeCountAsync as jest.Mock;

/** Captures the AppState listener so tests can drive a foreground. */
function captureAppState() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, cb: (state: AppStateStatus) => void) => {
      listener = cb;
      return { remove: jest.fn() } as never;
    });
  return {
    /**
     * Drive a foreground. The handler kicks off an async re-sync it does not
     * return, so this flushes inside `act` and callers still assert with
     * `waitFor`.
     */
    async foreground() {
      await act(async () => {
        listener?.('active');
      });
    },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = makeTestQueryClient();
  return (
    <I18nProvider initialOverride="he">
      <ActiveOrgProvider initialActiveOrgId={TEST_ORG}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ActiveOrgProvider>
    </I18nProvider>
  );
}

function serve(count: number, forms: unknown[] = []) {
  server.use(
    http.get(BADGE_PATH, () => HttpResponse.json({ data: { count } })),
    http.get(FORMS_PATH, () => HttpResponse.json({ data: forms })),
  );
}

beforeEach(() => {
  setBadgeCountAsync.mockClear();
});

describe('useAppIconBadge', () => {
  it('re-writes the icon on resume even when the count has not changed', async () => {
    serve(0);
    const appState = captureAppState();

    renderHook(() => useAppIconBadge(TEST_ORG), { wrapper });
    await waitFor(() => expect(setBadgeCountAsync).toHaveBeenCalledWith(0));

    // A push raised the OS badge while backgrounded. The server still says 0,
    // so nothing in React state changes on resume — which is precisely when
    // the old implementation went silent and stranded the push's number.
    setBadgeCountAsync.mockClear();
    await appState.foreground();

    await waitFor(() => expect(setBadgeCountAsync).toHaveBeenCalledWith(0));
  });

  it('writes the server total plus the forms still awaiting the member', async () => {
    serve(2, [
      { instance: { status: 'pending', archivedAt: null }, form: {} },
      { instance: { status: 'signed', archivedAt: null }, form: {} },
    ]);
    captureAppState();

    renderHook(() => useAppIconBadge(TEST_ORG), { wrapper });

    // 2 unread + 1 actionable form; the signed one is done and must not count.
    await waitFor(() => expect(setBadgeCountAsync).toHaveBeenCalledWith(3));
  });

  it('leaves the icon alone while the server count is unknown', async () => {
    // Count attempts so the assertion waits on the re-sync actually having
    // run, rather than racing it and passing for the wrong reason.
    let badgeAttempts = 0;
    server.use(
      http.get(BADGE_PATH, () => {
        badgeAttempts += 1;
        return HttpResponse.error();
      }),
      http.get(FORMS_PATH, () => HttpResponse.json({ data: [] })),
    );
    const appState = captureAppState();

    renderHook(() => useAppIconBadge(TEST_ORG), { wrapper });
    await waitFor(() => expect(badgeAttempts).toBeGreaterThan(0));

    const attemptsBeforeResume = badgeAttempts;
    await appState.foreground();
    await waitFor(() =>
      expect(badgeAttempts).toBeGreaterThan(attemptsBeforeResume),
    );

    // Writing here would clear a legitimate count a push set while the app was
    // closed, on nothing more than a failed request.
    expect(setBadgeCountAsync).not.toHaveBeenCalled();
  });
});
