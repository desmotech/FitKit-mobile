/**
 * Unified inbox — pins the member-visible states of the three tabs:
 * staged conversations render on the Direct tab (name, preview, unread
 * badge), the empty state shows the "no conversations" copy, a failed fetch
 * shows the retry card (never a misleading empty state), member-role
 * conversations are filtered out (the inbox is staff-only, mirroring the
 * web member surface), the Workouts tab lists recent workout threads that
 * deep-link into the in-workout chat, and `?tab=` deep-links select a tab.
 *
 * Network is the only thing staged (MSW): the real hooks, cache, and
 * screen logic run as in production. No RealtimeProvider is mounted, so
 * presence falls back to the no-op context.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@fitkit/shared';
import MessagesListScreen from '../messages/index';
import { conversation, stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';
import { inboxStringsFor } from '../../src/i18n/inbox-strings';
import { getWeekStartDay, weekStartFor } from '../../src/lib/week';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;
const heInbox = inboxStringsFor('he');

// Registered without the ?limit=50 the hook appends — MSW matches on path
// and ignores the request's search params.
const LIST_PATH = api(`/organizations/${TEST_ORG}/conversations`);

function stageConversations(items: ReturnType<typeof conversation>[]) {
  server.use(
    http.get(LIST_PATH, () =>
      HttpResponse.json({ data: { conversations: items } }),
    ),
  );
}

/** The chrome reads the announcements unread count for the tab badge. */
function stageInboxChrome() {
  server.use(
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
  mockSearchParams = {};
  stageSignedInMember();
  stageInboxChrome();
});

describe('Inbox — Direct tab', () => {
  it('renders staged conversations: name, last-message preview, unread badge', async () => {
    stageConversations([
      conversation({
        participantName: 'דנה לוי',
        participantRole: 'coach',
        lastMessage: 'נתראה מחר בבוקר',
        unreadCount: 3,
      }),
      conversation({
        participantName: 'יוסי כהן',
        participantRole: 'admin',
        lastMessage: 'המנוי חודש',
        unreadCount: 0,
      }),
    ]);

    await renderWithProviders(<MessagesListScreen />);

    expect(await screen.findByText('דנה לוי')).toBeOnTheScreen();
    expect(screen.getByText('נתראה מחר בבוקר')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('יוסי כהן')).toBeOnTheScreen();
    expect(screen.getByText('המנוי חודש')).toBeOnTheScreen();
  });

  it('opens the tapped conversation keyed by the participant membership id', async () => {
    stageConversations([
      conversation({
        participantMembershipId: 'mem_coach',
        participantName: 'דנה לוי',
      }),
    ]);

    await renderWithProviders(<MessagesListScreen />);
    await userEvent.press(await screen.findByText('דנה לוי'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'mem_coach' },
    });
  });

  it('shows the empty state when the member has no conversations', async () => {
    stageConversations([]);

    await renderWithProviders(<MessagesListScreen />);

    // Generous timeout: two sequential fetches (users/me → conversations)
    // must land first, and parallel workers can starve this one.
    await waitFor(
      () =>
        expect(screen.getByText(he.messages.noConversations)).toBeOnTheScreen(),
      { timeout: 5000 },
    );
    // The empty state offers a way forward: a new-message CTA in addition
    // to the one always present in the header. The CTA can commit a paint
    // after the empty text, so poll rather than assert the first frame.
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: he.messages.newMessage }),
      ).toHaveLength(2),
    );
  });

  // The he dictionary has no messages.loadFailed / loadFailedHint keys yet,
  // so the screen falls back to its inline English copy. When the keys ship
  // in @fitkit/shared, point these assertions at the dictionary.
  const LOAD_FAILED_COPY = "Couldn't load conversations";

  it('shows the retry card on failure — never the empty state', async () => {
    // 401: useApiQuery fails fast on auth errors (its hardcoded retry only
    // backs off non-401s), so the error path is deterministic and quick.
    server.use(
      http.get(LIST_PATH, () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );

    await renderWithProviders(<MessagesListScreen />);

    await waitFor(() =>
      expect(screen.getByText(LOAD_FAILED_COPY)).toBeOnTheScreen(),
    );
    expect(
      screen.getByRole('button', { name: he.common.tryAgain }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText(he.messages.noConversations),
    ).not.toBeOnTheScreen();
  });

  it('filters member-role conversations out — the inbox is staff-only', async () => {
    stageConversations([
      conversation({ participantName: 'דנה לוי', participantRole: 'coach' }),
      conversation({ participantName: 'רוני חבר', participantRole: 'member' }),
    ]);

    await renderWithProviders(<MessagesListScreen />);

    expect(await screen.findByText('דנה לוי')).toBeOnTheScreen();
    expect(screen.queryByText('רוני חבר')).not.toBeOnTheScreen();
  });
});

describe('Inbox — Workouts tab', () => {
  const thisWeek = weekStartFor(new Date(), getWeekStartDay('he'));

  function stageWeeks(assignments: Record<string, unknown>[]) {
    server.use(
      http.get(
        api(`/organizations/${TEST_ORG}/assignments/my-week`),
        ({ request }) => {
          const weekStart = new URL(request.url).searchParams.get('weekStart');
          return HttpResponse.json({
            data: weekStart === thisWeek ? assignments : [],
          });
        },
      ),
    );
  }

  it('lists recent workout threads and deep-links into the workout chat', async () => {
    stageConversations([]);
    stageWeeks([
      {
        id: 'as_fran',
        date: thisWeek,
        published: true,
        kind: 'workout',
        workout: { id: 'w1', displayName: 'Fran', scoring: 'time' },
        unreadCount: 2,
      },
    ]);

    await renderWithProviders(<MessagesListScreen />);
    await userEvent.press(
      await screen.findByRole('tab', { name: heInbox.tabWorkouts }),
    );

    await userEvent.press(await screen.findByText('Fran'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/workouts/[id]/chat',
      params: { id: 'as_fran', name: 'Fran' },
    });
  });

  it('shows the workouts empty state when no recent assignments exist', async () => {
    stageConversations([]);
    stageWeeks([]);

    await renderWithProviders(<MessagesListScreen />);
    await userEvent.press(
      await screen.findByRole('tab', { name: heInbox.tabWorkouts }),
    );

    await waitFor(() =>
      expect(screen.getByText(heInbox.noWorkoutThreads)).toBeOnTheScreen(),
    );
  });
});

describe('Inbox — deep links', () => {
  it('?tab=announcements opens the Announcements tab directly', async () => {
    mockSearchParams = { tab: 'announcements' };
    stageConversations([]);
    server.use(
      http.get(api(`/organizations/${TEST_ORG}/announcements`), () =>
        HttpResponse.json({
          data: { announcements: [], nextCursor: null },
        }),
      ),
    );

    await renderWithProviders(<MessagesListScreen />);

    await waitFor(() =>
      expect(screen.getByText(he.announcements.empty)).toBeOnTheScreen(),
    );
  });
});
