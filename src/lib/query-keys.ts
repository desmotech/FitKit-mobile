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
    config: (orgId: string) =>
      ['/organizations', orgId, 'payment-config'] as const,
  },
  subscriptions: {
    all: (orgId: string, filters?: Record<string, unknown>) =>
      ['/organizations', orgId, 'subscriptions', filters] as const,
    changePlanPreview: (
      orgId: string,
      subscriptionId: string,
      newPlanId: string,
    ) =>
      [
        '/organizations',
        orgId,
        'subscriptions',
        subscriptionId,
        'change-plan-preview',
        newPlanId,
      ] as const,
  },

  // ── Member-app keys ────────────────────────────────────────────────
  // Factories below match the EXACT shapes the mobile hooks have always
  // used (persisted caches + cross-file invalidations depend on them).
  // Every key that is read or invalidated from more than one file MUST
  // come from here — ad-hoc inline copies are how the stale-badge and
  // stale-summary bugs happened.
  badge: {
    total: (orgId: string) => ['badge-total', orgId] as const,
  },
  announcements: {
    list: (orgId: string) => ['announcements', orgId] as const,
    unreadCount: (orgId: string) =>
      ['announcements-unread-count', orgId] as const,
  },
  forms: {
    mine: (orgId: string) =>
      ['/organizations', orgId, 'forms', 'mine'] as const,
    instance: (orgId: string, instanceId: string) =>
      ['/organizations', orgId, 'forms', 'instances', instanceId] as const,
  },
  metrics: {
    summary: (orgId: string) =>
      ['/organizations', orgId, 'metrics', 'me'] as const,
    history: (orgId: string, membershipId: string, metricType: string) =>
      ['metrics-history', orgId, membershipId, metricType] as const,
  },
  assignments: {
    myWeek: (orgId: string, weekStart: string) =>
      ['/organizations', orgId, 'assignments', 'my-week', weekStart] as const,
    byId: (orgId: string, assignmentId: string) =>
      ['/organizations', orgId, 'assignments', assignmentId] as const,
  },
  programs: {
    all: (orgId: string) => ['/organizations', orgId, 'programs'] as const,
    myEnrollments: (orgId: string) =>
      ['/organizations', orgId, 'programs', 'my-enrollments'] as const,
  },
  results: {
    mine: (orgId: string) =>
      ['/organizations', orgId, 'results', 'me'] as const,
    latestForWorkout: (orgId: string, workoutId: string) =>
      [
        '/organizations',
        orgId,
        'workouts',
        workoutId,
        'results',
        'me',
        'latest',
      ] as const,
    workoutHistory: (orgId: string, workoutId: string) =>
      ['/organizations', orgId, 'workouts', workoutId, 'results'] as const,
  },
  exercises: {
    search: (orgId: string | undefined | null, q: string) =>
      ['/exercises/search', { orgId, q }] as const,
    historyMe: (orgId: string, exerciseId: string) =>
      [
        '/organizations',
        orgId,
        'exercises',
        exerciseId,
        'history',
        'me',
      ] as const,
    comments: (
      orgId: string | undefined | null,
      workoutId: string | undefined | null,
      movementId: string | undefined | null,
    ) => ['exercise-comments', orgId, workoutId, movementId] as const,
  },
  personalRecords: {
    mine: (orgId: string) =>
      ['/organizations', orgId, 'personal-records', 'me'] as const,
  },
  sessions: {
    week: (orgId: string, weekStart: string) =>
      ['/organizations', orgId, 'sessions', weekStart] as const,
    byId: (orgId: string, sessionId: string) =>
      ['/organizations', orgId, 'sessions', sessionId] as const,
    todayWorkouts: (orgId: string) =>
      ['/organizations', orgId, 'sessions', 'today-workouts'] as const,
  },
  members: {
    myStats: (orgId: string) =>
      ['/organizations', orgId, 'members', 'me', 'stats'] as const,
  },
  conversations: {
    // Key doubles as the fetch path (useApiQuery default), hence the
    // single-string shape.
    list: (orgId: string) =>
      [`/organizations/${orgId}/conversations?limit=50`] as const,
  },
  messageThreads: {
    all: () => ['messages'] as const,
    thread: (
      orgId: string | undefined | null,
      participantMembershipId: string | undefined | null,
    ) => ['messages', orgId, participantMembershipId] as const,
  },
  workoutComments: {
    all: (orgId: string | undefined | null) =>
      ['workout-comments', orgId] as const,
    thread: (
      orgId: string | undefined | null,
      workoutAssignmentId: string | undefined | null,
    ) => ['workout-comments', orgId, workoutAssignmentId] as const,
  },
  progressPhotos: {
    mine: (orgId: string | undefined | null) =>
      ['progress-photos', orgId, 'me'] as const,
  },
} as const;
