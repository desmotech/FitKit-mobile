/**
 * Contract test: persisted TanStack Query caches (async-storage persister)
 * and cross-file invalidations depend on these EXACT key shapes. Changing a
 * shape silently orphans every member's on-device cache and breaks
 * invalidation pairing — if a change here is intentional, it needs a cache
 * migration story, not just an updated assertion.
 */
import { queryKeys } from '../query-keys';

const ORG = 'org_1';

describe('queryKeys shapes are frozen (persisted-cache contract)', () => {
  it.each([
    ['users.me', queryKeys.users.me(), ['/users', 'me']],
    [
      'organizations.all',
      queryKeys.organizations.all(ORG),
      ['/organizations', ORG],
    ],
    [
      'classSessions.all with filters',
      queryKeys.classSessions.all(ORG, { from: 'a' }),
      ['/organizations', ORG, 'class-sessions', { from: 'a' }],
    ],
    [
      'bookings.all without filters',
      queryKeys.bookings.all(ORG),
      ['/organizations', ORG, 'bookings', undefined],
    ],
    [
      'workouts.all',
      queryKeys.workouts.all(ORG, { week: 'w' }),
      ['/organizations', ORG, 'workouts', { week: 'w' }],
    ],
    ['badge.total', queryKeys.badge.total(ORG), ['badge-total', ORG]],
    [
      'announcements.list',
      queryKeys.announcements.list(ORG),
      ['announcements', ORG],
    ],
    [
      'announcements.unreadCount',
      queryKeys.announcements.unreadCount(ORG),
      ['announcements-unread-count', ORG],
    ],
    [
      'forms.mine',
      queryKeys.forms.mine(ORG),
      ['/organizations', ORG, 'forms', 'mine'],
    ],
    [
      'metrics.summary',
      queryKeys.metrics.summary(ORG),
      ['/organizations', ORG, 'metrics', 'me'],
    ],
    [
      'metrics.history',
      queryKeys.metrics.history(ORG, 'mem_1', 'weight'),
      ['metrics-history', ORG, 'mem_1', 'weight'],
    ],
    [
      'assignments.myWeek',
      queryKeys.assignments.myWeek(ORG, '2026-07-05'),
      ['/organizations', ORG, 'assignments', 'my-week', '2026-07-05'],
    ],
    [
      'results.mine',
      queryKeys.results.mine(ORG),
      ['/organizations', ORG, 'results', 'me'],
    ],
    [
      'results.latestForWorkout',
      queryKeys.results.latestForWorkout(ORG, 'w_1'),
      ['/organizations', ORG, 'workouts', 'w_1', 'results', 'me', 'latest'],
    ],
    [
      'results.workoutHistory',
      queryKeys.results.workoutHistory(ORG, 'w_1'),
      ['/organizations', ORG, 'workouts', 'w_1', 'results'],
    ],
    [
      'exercises.search',
      queryKeys.exercises.search(ORG, 'squat'),
      ['/exercises/search', { orgId: ORG, q: 'squat' }],
    ],
    [
      'exercises.historyMe',
      queryKeys.exercises.historyMe(ORG, 'ex_1'),
      ['/organizations', ORG, 'exercises', 'ex_1', 'history', 'me'],
    ],
    [
      'exercises.comments',
      queryKeys.exercises.comments(ORG, 'w_1', 'm_1'),
      ['exercise-comments', ORG, 'w_1', 'm_1'],
    ],
    [
      'personalRecords.mine',
      queryKeys.personalRecords.mine(ORG),
      ['/organizations', ORG, 'personal-records', 'me'],
    ],
    [
      'sessions.week',
      queryKeys.sessions.week(ORG, '2026-07-05'),
      ['/organizations', ORG, 'sessions', '2026-07-05'],
    ],
    [
      'sessions.todayWorkouts',
      queryKeys.sessions.todayWorkouts(ORG),
      ['/organizations', ORG, 'sessions', 'today-workouts'],
    ],
    [
      'members.myStats',
      queryKeys.members.myStats(ORG),
      ['/organizations', ORG, 'members', 'me', 'stats'],
    ],
    [
      'conversations.list (key doubles as fetch path)',
      queryKeys.conversations.list(ORG),
      [`/organizations/${ORG}/conversations?limit=50`],
    ],
    ['messageThreads.all', queryKeys.messageThreads.all(), ['messages']],
    [
      'messageThreads.thread',
      queryKeys.messageThreads.thread(ORG, 'mem_2'),
      ['messages', ORG, 'mem_2'],
    ],
    [
      'workoutComments.thread',
      queryKeys.workoutComments.thread(ORG, 'wa_1'),
      ['workout-comments', ORG, 'wa_1'],
    ],
    [
      'progressPhotos.mine',
      queryKeys.progressPhotos.mine(ORG),
      ['progress-photos', ORG, 'me'],
    ],
  ])('%s', (_name, actual, expected) => {
    expect(actual).toEqual(expected);
  });

  it('workoutComments.all is a prefix of thread keys (invalidation pairing)', () => {
    const all = queryKeys.workoutComments.all(ORG);
    const thread = queryKeys.workoutComments.thread(ORG, 'wa_1');
    expect(thread.slice(0, all.length)).toEqual([...all]);
  });

  it('messageThreads.all is a prefix of thread keys (badge invalidation)', () => {
    const all = queryKeys.messageThreads.all();
    const thread = queryKeys.messageThreads.thread(ORG, 'mem_2');
    expect(thread.slice(0, all.length)).toEqual([...all]);
  });
});
