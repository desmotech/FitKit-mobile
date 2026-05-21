/**
 * TanStack Query keys. Mirrors apps/web/src/lib/query-keys.ts.
 *
 * TODO(phase-0.5): consolidate into @fitkit/shared so web and mobile
 * cannot drift. Deferred to keep the scaffold commit focused — moving
 * the file forces edits in 30+ web call sites.
 */
export const queryKeys = {
  users: {
    me: () => ['/users', 'me'] as const,
  },
  organizations: {
    all: (orgId: string) => ['/organizations', orgId] as const,
    members: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'members', filters] as const,
    settings: (orgId: string) => ['/organizations', orgId, 'settings'] as const,
  },
  classTypes: {
    all: (orgId: string) => ['/organizations', orgId, 'class-types'] as const,
  },
  classSessions: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'class-sessions', filters] as const,
  },
  bookings: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'bookings', filters] as const,
  },
  plans: {
    all: (orgId: string) => ['/organizations', orgId, 'plans'] as const,
  },
  workouts: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'workouts', filters] as const,
  },
  messages: {
    conversations: (orgId: string) =>
      ['/organizations', orgId, 'messages'] as const,
    thread: (orgId: string, threadId: string) =>
      ['/organizations', orgId, 'messages', threadId] as const,
  },
  payments: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'payments', filters] as const,
  },
  subscriptions: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'subscriptions', filters] as const,
  },
} as const;
