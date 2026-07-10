/**
 * Message-thread cache behavior over the real network boundary (MSW).
 *
 * What the code ACTUALLY does (and what these tests pin):
 *  - sendMessage is NOT optimistic — the outgoing message appears in the
 *    thread only when the server confirms, prepended as the server-returned
 *    row. A failed send therefore never leaves a ghost message behind.
 *  - markRead is NOT optimistic either — read state flips in onSuccess, and
 *    only when the server reports markedCount > 0. On failure the cache
 *    stays unread and the hook makes exactly one request per mutate call
 *    (the refire latch lives in the thread screen, not here).
 *
 * Realtime is out of scope: no RealtimeProvider is mounted, so the no-op
 * fallback applies.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { MessageResponse } from '@fitkit/shared';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { useMessages } from '../use-messages';
import { api, delay, http, HttpResponse, server } from '../../../test/msw';
import { makeTestQueryClient, TEST_ORG } from '../../../test/render';

const ME = 'mem_me';
const PARTICIPANT = 'mem_coach';
const THREAD_PATH = api(
  `/organizations/${TEST_ORG}/conversations/${PARTICIPANT}`,
);
const SEND_PATH = api(`/organizations/${TEST_ORG}/messages`);
const READ_PATH = api(
  `/organizations/${TEST_ORG}/conversations/${PARTICIPANT}/read`,
);

let messageSeq = 0;

/** Incoming message from the participant by default. */
function message(overrides: Partial<MessageResponse> = {}): MessageResponse {
  messageSeq += 1;
  return {
    id: `msg_${messageSeq}`,
    organizationId: TEST_ORG,
    senderMembershipId: PARTICIPANT,
    senderName: 'Coach Dana',
    senderRole: 'coach',
    recipientMembershipId: ME,
    content: `message ${messageSeq}`,
    attachments: [],
    createdAt: '2026-07-09T10:00:00.000Z',
    readAt: null,
    edited: false,
    workoutAssignmentId: null,
    ...overrides,
  };
}

function stageThread(messages: MessageResponse[]) {
  server.use(
    http.get(THREAD_PATH, () =>
      HttpResponse.json({
        data: { messages, nextCursor: null, hasMore: false },
      }),
    ),
  );
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initialOverride="he">
        <ActiveOrgProvider initialActiveOrgId={TEST_ORG}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ActiveOrgProvider>
      </I18nProvider>
    );
  };
}

/** Mount the thread hook and wait for the initial page to load. */
async function renderThread() {
  const rendered = await renderHook(
    () => useMessages(TEST_ORG, PARTICIPANT, ME),
    { wrapper: makeWrapper(makeTestQueryClient()) },
  );
  await waitFor(() =>
    expect(rendered.result.current.query.isSuccess).toBe(true),
  );
  return rendered;
}

describe('useMessages — sending', () => {
  it('prepends the server-confirmed message to the thread (send is not optimistic)', async () => {
    const existing = message({ content: 'earlier' });
    stageThread([existing]);
    const bodies: unknown[] = [];
    server.use(
      http.post(SEND_PATH, async ({ request }) => {
        bodies.push(await request.json());
        await delay(150);
        return HttpResponse.json({
          data: message({
            id: 'msg_server',
            senderMembershipId: ME,
            recipientMembershipId: PARTICIPANT,
            content: 'שלום המאמנת',
          }),
        });
      }),
    );

    const { result } = await renderThread();

    await act(async () => {
      result.current.sendMessage.mutate({ content: 'שלום המאמנת' });
    });

    // While the request is in flight nothing is added — the member sees the
    // message only once the server has accepted it.
    await waitFor(() =>
      expect(result.current.sendMessage.isPending).toBe(true),
    );
    expect(result.current.allMessages).toHaveLength(1);

    await waitFor(() =>
      expect(result.current.sendMessage.isSuccess).toBe(true),
    );
    expect(result.current.allMessages.map((m) => m.id)).toEqual([
      'msg_server',
      existing.id,
    ]);
    expect(result.current.allMessages[0]?.content).toBe('שלום המאמנת');
    // The hook fills in the thread's recipient itself.
    expect(bodies).toEqual([
      { content: 'שלום המאמנת', recipientMembershipId: PARTICIPANT },
    ]);
  });

  it('leaves the thread untouched when the send fails — no ghost message', async () => {
    const existing = message({ content: 'earlier' });
    stageThread([existing]);
    server.use(
      http.post(SEND_PATH, () =>
        HttpResponse.json({ message: 'send failed' }, { status: 500 }),
      ),
    );

    const { result } = await renderThread();

    await act(async () => {
      result.current.sendMessage.mutate({ content: 'לא יישלח' });
    });

    await waitFor(() => expect(result.current.sendMessage.isError).toBe(true));
    expect(result.current.allMessages.map((m) => m.id)).toEqual([existing.id]);
    expect(
      result.current.allMessages.some((m) => m.content === 'לא יישלח'),
    ).toBe(false);
  });
});

describe('useMessages — marking the thread read', () => {
  it('flips my unread incoming messages once the server confirms, not my own sent ones', async () => {
    const incomingA = message();
    const incomingB = message();
    const mine = message({
      senderMembershipId: ME,
      senderRole: 'member',
      recipientMembershipId: PARTICIPANT,
    });
    stageThread([incomingA, incomingB, mine]);
    server.use(
      http.put(READ_PATH, () =>
        HttpResponse.json({ data: { markedCount: 2 } }),
      ),
    );

    const { result } = await renderThread();

    await act(async () => {
      result.current.markRead.mutate();
    });

    await waitFor(() => {
      const byId = new Map(result.current.allMessages.map((m) => [m.id, m]));
      expect(byId.get(incomingA.id)?.readAt).toBeTruthy();
      expect(byId.get(incomingB.id)?.readAt).toBeTruthy();
    });
    // My own sent message waits for the participant's read receipt.
    expect(
      result.current.allMessages.find((m) => m.id === mine.id)?.readAt,
    ).toBeNull();
  });

  it('changes nothing when the server reports nothing was marked', async () => {
    const incoming = message();
    stageThread([incoming]);
    server.use(
      http.put(READ_PATH, () =>
        HttpResponse.json({ data: { markedCount: 0 } }),
      ),
    );

    const { result } = await renderThread();

    await act(async () => {
      result.current.markRead.mutate();
    });

    await waitFor(() => expect(result.current.markRead.isSuccess).toBe(true));
    expect(result.current.allMessages[0]?.readAt).toBeNull();
  });

  it('keeps messages unread on failure and fires exactly one request — no retry loop', async () => {
    const incoming = message();
    stageThread([incoming]);
    let readCalls = 0;
    server.use(
      http.put(READ_PATH, () => {
        readCalls += 1;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }),
    );

    const { result } = await renderThread();

    await act(async () => {
      result.current.markRead.mutate();
    });

    await waitFor(() => expect(result.current.markRead.isError).toBe(true));
    // Give any (buggy) retry a chance to fire before pinning the count.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(readCalls).toBe(1);
    expect(result.current.allMessages[0]?.readAt).toBeNull();
  });
});
