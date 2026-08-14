/**
 * Announcements — now the third tab of the unified inbox, plus a pushed
 * detail screen. Pins the four user-visible states of the read path:
 * failed fetch shows a retry card (never a misleading empty state), retry
 * recovers, empty shows the "nothing yet" state, and data renders. Tapping
 * a row deep-links to the detail route; the detail screen renders the full
 * body and marks the announcement read on the server. Copy is asserted
 * against the real Hebrew dictionary, so tests follow copy edits.
 *
 * Network is the only thing staged (MSW): the real query hooks, cache, and
 * screen logic run exactly as in production.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@fitkit/shared';
import InboxScreen from '../messages/index';
import AnnouncementDetailScreen from '../messages/announcement/[id]';
import { announcement, stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';
import { inboxStringsFor } from '../../src/i18n/inbox-strings';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;
const heInbox = inboxStringsFor('he');
const LIST_PATH = api(`/organizations/${TEST_ORG}/announcements`);

function stageAnnouncements(items: ReturnType<typeof announcement>[]) {
  server.use(
    http.get(LIST_PATH, () =>
      HttpResponse.json({ data: { announcements: items, nextCursor: null } }),
    ),
  );
}

/** The inbox chrome also reads conversations + the unread-count badge. */
function stageInboxChrome() {
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/announcements/unread-count`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
  );
}

const mockRouterPush = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: mockRouterPush,
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockRouterPush.mockClear();
  // Land directly on the Announcements tab, as the deep link does.
  mockSearchParams = { tab: 'announcements' };
  stageSignedInMember();
  stageInboxChrome();
});

describe('Inbox — Announcements tab', () => {
  it('shows the announcements once they load', async () => {
    stageAnnouncements([
      announcement({ title: 'אימון בוקר מבוטל' }),
      announcement({ title: 'סדנת מוביליטי בשישי' }),
    ]);

    await renderWithProviders(<InboxScreen />);

    expect(await screen.findByText('אימון בוקר מבוטל')).toBeOnTheScreen();
    expect(screen.getByText('סדנת מוביליטי בשישי')).toBeOnTheScreen();
  });

  it('shows the empty state when the studio has posted nothing', async () => {
    stageAnnouncements([]);

    await renderWithProviders(<InboxScreen />);

    await waitFor(() =>
      expect(screen.getByText(he.announcements.empty)).toBeOnTheScreen(),
    );
  });

  it('shows a retry card on failure — never the empty state', async () => {
    server.use(
      http.get(LIST_PATH, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<InboxScreen />);

    await waitFor(() =>
      expect(screen.getByText(heInbox.loadFailed)).toBeOnTheScreen(),
    );
    expect(screen.queryByText(he.announcements.empty)).not.toBeOnTheScreen();
  });

  it('recovers when the member taps retry and the network is back', async () => {
    server.use(
      http.get(LIST_PATH, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<InboxScreen />);
    await screen.findByText(heInbox.loadFailed);

    stageAnnouncements([announcement({ title: 'חזרנו לאוויר' })]);
    await userEvent.press(
      screen.getByRole('button', { name: he.common.tryAgain }),
    );

    expect(await screen.findByText('חזרנו לאוויר')).toBeOnTheScreen();
  });

  it('deep-links a tapped announcement to its detail route', async () => {
    stageAnnouncements([
      announcement({ id: 'ann_target', title: 'שינוי בלוח הזמנים' }),
    ]);

    await renderWithProviders(<InboxScreen />);
    await userEvent.press(await screen.findByText('שינוי בלוח הזמנים'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/messages/announcement/[id]',
      params: { id: 'ann_target' },
    });
  });
});

describe('Announcement detail', () => {
  it('renders the full announcement and marks it read on the server', async () => {
    const readCalls: string[] = [];
    mockSearchParams = { id: 'ann_target' };
    stageAnnouncements([
      announcement({
        id: 'ann_target',
        title: 'שינוי בלוח הזמנים',
        content: 'החל מהשבוע',
      }),
    ]);
    server.use(
      http.put(
        api(`/organizations/${TEST_ORG}/announcements/:id/read`),
        ({ params }) => {
          readCalls.push(params.id as string);
          return HttpResponse.json({ data: { ok: true } });
        },
      ),
    );

    await renderWithProviders(<AnnouncementDetailScreen />);

    expect(await screen.findByText('שינוי בלוח הזמנים')).toBeOnTheScreen();
    expect(screen.getByText('החל מהשבוע')).toBeOnTheScreen();
    await waitFor(() => expect(readCalls).toEqual(['ann_target']));
  });
});
