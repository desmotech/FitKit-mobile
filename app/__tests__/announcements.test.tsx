/**
 * Announcements screen — the four user-visible states of a read path:
 * failed fetch shows a retry card (never a misleading empty state), retry
 * recovers, empty shows the "nothing yet" state, and data renders. Copy is
 * asserted against the real Hebrew dictionary, so tests follow copy edits.
 *
 * Network is the only thing staged (MSW): the real query hooks, cache, and
 * screen logic run exactly as in production.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@fitkit/shared';
import AnnouncementsScreen from '../announcements';
import { announcement, stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;
const LIST_PATH = api(`/organizations/${TEST_ORG}/announcements`);

function stageAnnouncements(items: ReturnType<typeof announcement>[]) {
  server.use(
    http.get(LIST_PATH, () =>
      HttpResponse.json({ data: { announcements: items, nextCursor: null } }),
    ),
  );
}

// The screen's Done button calls router.back(); no navigator is mounted in
// these tests, so stub the router surface it touches.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => {
  stageSignedInMember();
});

describe('Announcements screen', () => {
  it('shows the announcements once they load', async () => {
    stageAnnouncements([
      announcement({ title: 'אימון בוקר מבוטל' }),
      announcement({ title: 'סדנת מוביליטי בשישי' }),
    ]);

    await renderWithProviders(<AnnouncementsScreen />);

    expect(await screen.findByText('אימון בוקר מבוטל')).toBeOnTheScreen();
    expect(screen.getByText('סדנת מוביליטי בשישי')).toBeOnTheScreen();
  });

  it('shows the empty state when the studio has posted nothing', async () => {
    stageAnnouncements([]);

    await renderWithProviders(<AnnouncementsScreen />);

    await waitFor(() =>
      expect(screen.getByText(he.announcements.empty)).toBeOnTheScreen(),
    );
  });

  // The he dictionary has no announcements.loadFailed key yet, so the screen
  // falls back to its inline English copy. When the key ships in
  // @fitkit/shared, point these assertions at the dictionary.
  const LOAD_FAILED_COPY = "Couldn't load announcements";

  it('shows a retry card on failure — never the empty state', async () => {
    server.use(
      http.get(LIST_PATH, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<AnnouncementsScreen />);

    await waitFor(() =>
      expect(screen.getByText(LOAD_FAILED_COPY)).toBeOnTheScreen(),
    );
    expect(screen.queryByText(he.announcements.empty)).not.toBeOnTheScreen();
  });

  it('recovers when the member taps retry and the network is back', async () => {
    server.use(
      http.get(LIST_PATH, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<AnnouncementsScreen />);
    await screen.findByText(LOAD_FAILED_COPY);

    stageAnnouncements([announcement({ title: 'חזרנו לאוויר' })]);
    await userEvent.press(
      screen.getByRole('button', { name: he.common.tryAgain }),
    );

    expect(await screen.findByText('חזרנו לאוויר')).toBeOnTheScreen();
  });

  it('opens a tapped announcement and marks it read on the server', async () => {
    const readCalls: string[] = [];
    stageAnnouncements([
      announcement({ id: 'ann_target', title: 'שינוי בלוח הזמנים', content: 'החל מהשבוע' }),
    ]);
    server.use(
      http.put(
        api(`/organizations/${TEST_ORG}/announcements/:id/read`),
        ({ params }) => {
          readCalls.push(params.id as string);
          return HttpResponse.json({ data: { ok: true } });
        },
      ),
      http.get(
        api(`/organizations/${TEST_ORG}/announcements/unread-count`),
        () => HttpResponse.json({ data: { count: 0 } }),
      ),
    );

    await renderWithProviders(<AnnouncementsScreen />);

    await userEvent.press(await screen.findByText('שינוי בלוח הזמנים'));

    expect(await screen.findByText('החל מהשבוע')).toBeOnTheScreen();
    await waitFor(() => expect(readCalls).toEqual(['ann_target']));
  });
});
