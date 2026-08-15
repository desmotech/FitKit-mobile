/**
 * RealtimeProvider — React Native port of
 * `apps/web/src/providers/realtime-provider.tsx`.
 *
 * Opens a single Socket.IO connection to the API's `/ws` namespace and
 * exposes thin `on*` subscription helpers that feature hooks plug into
 * (mirroring the web client). The server-side event contract is identical:
 *
 *   server → client : `message`, `message:read`, `user:typing`,
 *                      `user:online`, `user:offline`, `unread:updated`,
 *                      `announcement`, `announcement:unread`
 *   client → server : `subscribe { orgId, membershipId }`,
 *                      `typing { recipientMembershipId }`
 *
 * Mobile-specific lifecycle (per docs/architecture/mobile.md): the socket
 * connects in the foreground and disconnects on background via `AppState`,
 * so we don't hold a radio open behind the user. The *same* socket instance
 * is reused across foreground/background cycles (`connect()` / `disconnect()`
 * rather than re-`io()`), so listeners registered by hooks survive — and the
 * instance is created lazily during render so it exists before child effects
 * register their listeners (no mount-order race).
 */
import { useAuth } from '@clerk/clerk-expo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { AnnouncementResponse, MessageResponse } from '@fitkit/shared';
import { wsUrl } from '@/lib/api';

export type MessagePayload = MessageResponse;

type ReadReceipt = { messageId: string; readAt: string };
type TypingEvent = { senderMembershipId: string; recipientMembershipId: string };
type PresenceEvent = { membershipId: string };
type UnreadEvent = { count: number };

type RealtimeContextValue = {
  isConnected: boolean;
  subscribeToOrg: (orgId: string, membershipId: string) => void;
  sendTyping: (recipientMembershipId: string) => void;
  onMessage: (handler: (msg: MessagePayload) => void) => () => void;
  onReadReceipt: (handler: (data: ReadReceipt) => void) => () => void;
  onTyping: (handler: (data: TypingEvent) => void) => () => void;
  onUnreadUpdated: (handler: (data: UnreadEvent) => void) => () => void;
  onUserOnline: (handler: (data: PresenceEvent) => void) => () => void;
  onUserOffline: (handler: (data: PresenceEvent) => void) => () => void;
  onAnnouncement: (handler: (data: AnnouncementResponse) => void) => () => void;
  onAnnouncementUnread: (handler: (data: UnreadEvent) => void) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const DEDUP_CACHE_SIZE = 100;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentSubRef = useRef<{ orgId: string; membershipId: string } | null>(
    null,
  );

  // Keep the latest getToken without re-creating the socket (Clerk may hand
  // back a new function identity on each render). The `auth` callback reads
  // through the ref so every (re)connect attaches a fresh JWT.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Lazily create the socket once, during render, so it exists before any
  // child effect calls `onMessage`/etc. `autoConnect: false` — the effect
  // below owns connect/disconnect based on auth + AppState.
  if (socketRef.current === null) {
    const socket = io(`${wsUrl}/ws`, {
      autoConnect: false,
      // websocket-only on native (no XHR polling fallback).
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      auth: (cb: (data: object) => void) => {
        getTokenRef
          .current()
          .then((tok) => cb({ token: tok ?? '' }))
          .catch(() => cb({ token: '' }));
      },
    });

    socket.on('connect', () => {
      setIsConnected(true);
      // Re-subscribe to the org room on (re)connect so presence + delivery
      // resume after a background→foreground cycle.
      const sub = currentSubRef.current;
      if (sub) socket.emit('subscribe', sub);
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    socketRef.current = socket;
  }

  // Connect in the foreground when signed in; disconnect on background or
  // sign-out. Reuses the same instance so hook listeners persist.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const connectIfNeeded = () => {
      if (isSignedIn && AppState.currentState === 'active' && !socket.connected) {
        socket.connect();
      }
    };

    // Socket.IO's own backoff caps at 30s, so a member who loses signal for a
    // few minutes can sit up to half a minute past the moment the network
    // returns before messages start arriving again — with the app open in
    // front of them. Nudging it the instant connectivity is restored closes
    // that window; a `connect()` on an already-connected socket is a no-op.
    const stopWatchingNetwork = onlineManager.subscribe((online) => {
      if (online) connectIfNeeded();
    });

    if (isSignedIn) {
      connectIfNeeded();
    } else {
      // Drop the cached room subscription on sign-out — the connect
      // handler replays it on reconnect, and a different user signing in
      // on this device must not resubscribe to the previous user's
      // org/membership before their own /users/me resolves.
      currentSubRef.current = null;
      socket.disconnect();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') connectIfNeeded();
      else socket.disconnect();
    });

    return () => {
      sub.remove();
      stopWatchingNetwork();
    };
  }, [isSignedIn]);

  // Fully tear down on provider unmount.
  useEffect(() => {
    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribeToOrg = useCallback((orgId: string, membershipId: string) => {
    currentSubRef.current = { orgId, membershipId };
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('subscribe', { orgId, membershipId });
  }, []);

  const sendTyping = useCallback((recipientMembershipId: string) => {
    socketRef.current?.emit('typing', { recipientMembershipId });
  }, []);

  const onMessage = useCallback(
    (handler: (msg: MessagePayload) => void) => {
      // Per-listener dedup so double-delivery doesn't double-apply, while
      // independent consumers (open thread + inbox) each still receive it.
      const seen = new Set<string>();
      const deduped = (msg: MessagePayload) => {
        if (msg?.id) {
          if (seen.has(msg.id)) return;
          seen.add(msg.id);
          if (seen.size > DEDUP_CACHE_SIZE) {
            const first = seen.values().next().value;
            if (first) seen.delete(first);
          }
        }
        handler(msg);
      };
      socketRef.current?.on('message', deduped);
      return () => {
        socketRef.current?.off('message', deduped);
      };
    },
    [],
  );

  const onReadReceipt = useCallback((handler: (data: ReadReceipt) => void) => {
    socketRef.current?.on('message:read', handler);
    return () => {
      socketRef.current?.off('message:read', handler);
    };
  }, []);

  const onTyping = useCallback((handler: (data: TypingEvent) => void) => {
    socketRef.current?.on('user:typing', handler);
    return () => {
      socketRef.current?.off('user:typing', handler);
    };
  }, []);

  const onUnreadUpdated = useCallback((handler: (data: UnreadEvent) => void) => {
    socketRef.current?.on('unread:updated', handler);
    return () => {
      socketRef.current?.off('unread:updated', handler);
    };
  }, []);

  const onUserOnline = useCallback((handler: (data: PresenceEvent) => void) => {
    socketRef.current?.on('user:online', handler);
    return () => {
      socketRef.current?.off('user:online', handler);
    };
  }, []);

  const onUserOffline = useCallback((handler: (data: PresenceEvent) => void) => {
    socketRef.current?.on('user:offline', handler);
    return () => {
      socketRef.current?.off('user:offline', handler);
    };
  }, []);

  const onAnnouncement = useCallback(
    (handler: (data: AnnouncementResponse) => void) => {
      socketRef.current?.on('announcement', handler);
      return () => {
        socketRef.current?.off('announcement', handler);
      };
    },
    [],
  );

  const onAnnouncementUnread = useCallback(
    (handler: (data: UnreadEvent) => void) => {
      socketRef.current?.on('announcement:unread', handler);
      return () => {
        socketRef.current?.off('announcement:unread', handler);
      };
    },
    [],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({
      isConnected,
      subscribeToOrg,
      sendTyping,
      onMessage,
      onReadReceipt,
      onTyping,
      onUnreadUpdated,
      onUserOnline,
      onUserOffline,
      onAnnouncement,
      onAnnouncementUnread,
    }),
    [
      isConnected,
      subscribeToOrg,
      sendTyping,
      onMessage,
      onReadReceipt,
      onTyping,
      onUnreadUpdated,
      onUserOnline,
      onUserOffline,
      onAnnouncement,
      onAnnouncementUnread,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

const noopUnsub = () => () => undefined;

const noopRealtime: RealtimeContextValue = {
  isConnected: false,
  subscribeToOrg: () => undefined,
  sendTyping: () => undefined,
  onMessage: noopUnsub,
  onReadReceipt: noopUnsub,
  onTyping: noopUnsub,
  onUnreadUpdated: noopUnsub,
  onUserOnline: noopUnsub,
  onUserOffline: noopUnsub,
  onAnnouncement: noopUnsub,
  onAnnouncementUnread: noopUnsub,
};

export function useRealtime() {
  return useContext(RealtimeContext) ?? noopRealtime;
}

/**
 * Tracks which membershipIds are currently online, maintained from the
 * `user:online` / `user:offline` presence events. Local to each caller so
 * presence changes don't re-render the whole tree. Note: presence is
 * event-driven with no initial snapshot — a participant who was already
 * online before this screen mounted only lights up once they reconnect or
 * act (same limitation as web).
 */
export function usePresence(): Set<string> {
  const { onUserOnline, onUserOffline } = useRealtime();
  const [online, setOnline] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const offOnline = onUserOnline(({ membershipId }) =>
      setOnline((prev) => {
        if (prev.has(membershipId)) return prev;
        const next = new Set(prev);
        next.add(membershipId);
        return next;
      }),
    );
    const offOffline = onUserOffline(({ membershipId }) =>
      setOnline((prev) => {
        if (!prev.has(membershipId)) return prev;
        const next = new Set(prev);
        next.delete(membershipId);
        return next;
      }),
    );
    return () => {
      offOnline();
      offOffline();
    };
  }, [onUserOnline, onUserOffline]);

  return online;
}
