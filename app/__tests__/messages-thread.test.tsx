/**
 * Message thread — the one-on-one chat screen. Pins the member-visible
 * behaviors: staged messages render as bubbles, sending POSTs the exact body
 * and shows the server-confirmed row (send is NOT optimistic), a failed send
 * alerts with the dictionary copy and never leaves a ghost bubble, the
 * load-earlier affordance pages back through history cursor by cursor, and
 * an unread thread is marked read on open (exactly once).
 *
 * Out of scope — attachments/uploads (image picker, resize, presigned PUT,
 * preview chips, lightbox): the flow is native-heavy (expo-image-picker /
 * -manipulator / -file-system) and can't be driven meaningfully from Jest.
 * Realtime presence/typing is also out: no RealtimeProvider is mounted, so
 * the no-op fallback applies (same as production before the socket connects).
 */
import { Alert } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { MessageResponse } from '@fitkit/shared';
import { dictionaries } from '@fitkit/shared';
import ChatScreen from '../messages/[id]';
import { conversation, stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;

// The [id] route param is the participant's membership id. Dereferenced at
// call time inside the factory, so the lazy jest.mock hoisting is safe.
const mockParticipantId = 'mem_coach';
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: mockParticipantId }),
}));

const PARTICIPANT = mockParticipantId;
// The signed-in member's own membership id — stageSignedInMember()'s fixture.
const ME = 'mem_test';

const THREAD_PATH = api(
  `/organizations/${TEST_ORG}/conversations/${PARTICIPANT}`,
);
const LIST_PATH = api(`/organizations/${TEST_ORG}/conversations`);
const SEND_PATH = api(`/organizations/${TEST_ORG}/messages`);
const READ_PATH = api(
  `/organizations/${TEST_ORG}/conversations/${PARTICIPANT}/read`,
);
const MEMBER_PATH = api(`/organizations/${TEST_ORG}/members/${PARTICIPANT}`);

let messageSeq = 0;

/** Incoming message from the participant by default — already read, so the
 *  screen's mark-read-on-open effect stays quiet unless a test opts in. */
function message(overrides: Partial<MessageResponse> = {}): MessageResponse {
  messageSeq += 1;
  return {
    id: `msg_${messageSeq}`,
    organizationId: TEST_ORG,
    senderMembershipId: PARTICIPANT,
    senderName: 'דנה לוי',
    senderRole: 'coach',
    recipientMembershipId: ME,
    content: `message ${messageSeq}`,
    attachments: [],
    createdAt: '2026-07-09T10:00:00.000Z',
    readAt: '2026-07-09T10:05:00.000Z',
    edited: false,
    workoutAssignmentId: null,
    ...overrides,
  };
}

type Page = { messages: MessageResponse[]; nextCursor?: string | null };

/** Cursor-aware thread handler: no cursor → first page; otherwise the staged
 *  page for that cursor. An unstaged cursor 404s so a wrong request fails. */
function stageThread(firstPage: Page, byCursor: Record<string, Page> = {}) {
  server.use(
    http.get(THREAD_PATH, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      const page = cursor ? byCursor[cursor] : firstPage;
      if (!page) {
        return HttpResponse.json({ message: 'unknown cursor' }, { status: 404 });
      }
      return HttpResponse.json({
        data: {
          messages: page.messages,
          nextCursor: page.nextCursor ?? null,
          hasMore: !!page.nextCursor,
        },
      });
    }),
  );
}

beforeEach(() => {
  stageSignedInMember();
  server.use(
    // Header participant info resolves from the cached conversation list.
    http.get(LIST_PATH, () =>
      HttpResponse.json({
        data: {
          conversations: [
            conversation({
              participantMembershipId: PARTICIPANT,
              participantName: 'דנה לוי',
              participantRole: 'coach',
            }),
          ],
        },
      }),
    ),
    // The screen races a direct member fetch while the conversation list is
    // still in flight (deep-link fallback) — stage it so the window between
    // orgId resolving and the list landing can't fail the test.
    http.get(MEMBER_PATH, () =>
      HttpResponse.json({
        data: {
          id: PARTICIPANT,
          role: 'coach',
          user: { firstName: 'דנה', lastName: 'לוי', imageUrl: null },
        },
      }),
    ),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Message thread', () => {
  it('renders the staged conversation: participant header and message bubbles', async () => {
    stageThread({
      messages: [
        message({
          senderMembershipId: ME,
          senderRole: 'member',
          recipientMembershipId: PARTICIPANT,
          content: 'היה אימון מעולה, תודה',
        }),
        message({ content: 'בוקר טוב! איך היה האימון?' }),
      ],
    });

    await renderWithProviders(<ChatScreen />);

    expect(
      await screen.findByText('בוקר טוב! איך היה האימון?'),
    ).toBeOnTheScreen();
    expect(screen.getByText('היה אימון מעולה, תודה')).toBeOnTheScreen();
    // Participant name renders twice: the header (from the conversations
    // list) and the sender label above the received bubble.
    await waitFor(() => expect(screen.getAllByText('דנה לוי')).toHaveLength(2));
  });

  it('sends the typed message: exact POST body, server row appears, composer clears', async () => {
    stageThread({ messages: [message({ content: 'הודעה קיימת' })] });
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(SEND_PATH, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          data: message({
            id: 'msg_server',
            senderMembershipId: ME,
            senderRole: 'member',
            recipientMembershipId: PARTICIPANT,
            content: 'נתראה מחר בבוקר',
            readAt: null,
            createdAt: '2026-07-09T11:00:00.000Z',
          }),
        });
      }),
    );

    await renderWithProviders(<ChatScreen />);
    await screen.findByText('הודעה קיימת');

    const composer = screen.getByPlaceholderText(he.messages.typePlaceholder);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();

    await userEvent.type(composer, 'נתראה מחר בבוקר');
    expect(send).toBeEnabled();
    await userEvent.press(send);

    await waitFor(() => expect(bodies).toHaveLength(1));
    // The screen fills in the thread's recipient itself; no attachment ids
    // when nothing was picked (absent, not an empty array).
    expect(bodies[0]).toEqual({
      content: 'נתראה מחר בבוקר',
      recipientMembershipId: PARTICIPANT,
    });

    // The bubble is the server-returned row (send is not optimistic).
    expect(await screen.findByText('נתראה מחר בבוקר')).toBeOnTheScreen();
    await waitFor(() => expect(composer).toHaveDisplayValue(''));
  });

  it('alerts on send failure with the dictionary copy — no ghost bubble, draft kept', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    stageThread({ messages: [message({ content: 'הודעה קיימת' })] });
    server.use(
      http.post(SEND_PATH, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<ChatScreen />);
    await screen.findByText('הודעה קיימת');

    const composer = screen.getByPlaceholderText(he.messages.typePlaceholder);
    await userEvent.type(composer, 'הודעה שלא תישלח');
    await userEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(he.messages.sendFailed),
    );
    // The failed text never appears as a message row (queryByText matches
    // Text bubbles, not the composer's input value)...
    expect(screen.queryByText('הודעה שלא תישלח')).not.toBeOnTheScreen();
    // ...and the member's draft is not thrown away.
    expect(composer).toHaveDisplayValue('הודעה שלא תישלח');
  });

  it('pages back through history: load-earlier appears with a cursor, fetches page 2, then disappears', async () => {
    stageThread(
      {
        messages: [message({ content: 'ההודעה החדשה ביותר' })],
        nextCursor: 'cur_older',
      },
      {
        cur_older: {
          messages: [
            message({
              content: 'הודעה ישנה יותר',
              createdAt: '2026-07-08T09:00:00.000Z',
            }),
          ],
        },
      },
    );

    await renderWithProviders(<ChatScreen />);
    await screen.findByText('ההודעה החדשה ביותר');

    const loadEarlier = await screen.findByText(he.messages.loadEarlier);
    await userEvent.press(loadEarlier);

    expect(await screen.findByText('הודעה ישנה יותר')).toBeOnTheScreen();
    // First page still on screen alongside the older one.
    expect(screen.getByText('ההודעה החדשה ביותר')).toBeOnTheScreen();
    // Page 2 has no cursor — the affordance goes away.
    await waitFor(() =>
      expect(screen.queryByText(he.messages.loadEarlier)).not.toBeOnTheScreen(),
    );
  });

  it('marks the thread read on open when unread incoming messages exist — exactly one PUT', async () => {
    stageThread({
      messages: [
        message({ content: 'הודעה שלא נקראה', readAt: null }),
        message({ content: 'עוד אחת שלא נקראה', readAt: null }),
      ],
    });
    let readCalls = 0;
    server.use(
      http.put(READ_PATH, () => {
        readCalls += 1;
        return HttpResponse.json({ data: { markedCount: 2 } });
      }),
    );

    await renderWithProviders(<ChatScreen />);
    await screen.findByText('הודעה שלא נקראה');

    await waitFor(() => expect(readCalls).toBe(1));
    // After onSuccess flips readAt in the cache, unreadCount drops to 0 —
    // flush a macrotask and confirm the effect did not refire.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(readCalls).toBe(1));
  });

  it('does not mark read when everything incoming is already read', async () => {
    // No PUT handler staged — an unexpected mark-read request would fail the
    // test via MSW's onUnhandledRequest: 'error'.
    stageThread({ messages: [message({ content: 'הודעה שנקראה מזמן' })] });

    await renderWithProviders(<ChatScreen />);
    await screen.findByText('הודעה שנקראה מזמן');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('הודעה שנקראה מזמן')).toBeOnTheScreen();
  });
});
