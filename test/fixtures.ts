/**
 * API response factories for MSW handlers. Shapes mirror the @fitkit/shared
 * response schemas; overrides let each test state only what it cares about.
 */
import type {
  AnnouncementResponse,
  ConversationResponse,
  MembershipResponse,
  PersonalRecordResponse,
  SubscriptionWithPlan,
  UserWithMembershipsResponse,
} from '@fitkit/shared';
import { api, http, HttpResponse, server } from './msw';
import { TEST_ORG } from './render';
import type {
  CourseDay,
  CourseEntitlement,
  CourseSession,
  CourseWorkoutDetail,
} from '@/types/courses';

export function membership(
  overrides: Partial<MembershipResponse> = {},
): MembershipResponse {
  return {
    id: 'mem_test',
    organizationId: TEST_ORG,
    userId: 'user_test',
    role: 'member',
    status: 'active',
    organization: {
      id: TEST_ORG,
      name: 'Test Gym',
    },
    ...overrides,
  } as MembershipResponse;
}

export function userMe(
  overrides: Partial<UserWithMembershipsResponse> = {},
): UserWithMembershipsResponse {
  return {
    id: 'user_test',
    firstName: 'Test',
    lastName: 'Member',
    email: 'member@test.local',
    profileComplete: true,
    pendingLegalConsents: false,
    memberships: [membership()],
    ...overrides,
  } as UserWithMembershipsResponse;
}

/** Stage the baseline every signed-in screen needs: GET /users/me. */
export function stageSignedInMember(
  user: UserWithMembershipsResponse = userMe(),
) {
  server.use(
    http.get(api('/users/me'), () => HttpResponse.json({ data: user })),
  );
}

let conversationSeq = 0;

/** DM inbox row — a staff (coach) participant by default. */
export function conversation(
  overrides: Partial<ConversationResponse> = {},
): ConversationResponse {
  conversationSeq += 1;
  return {
    participantMembershipId: `mem_participant_${conversationSeq}`,
    participantName: `Participant ${conversationSeq}`,
    participantRole: 'coach',
    participantAvatar: null,
    lastMessage: `Last message ${conversationSeq}`,
    lastMessageAt: '2026-07-09T10:00:00.000Z',
    unreadCount: 0,
    ...overrides,
  };
}

let prSeq = 0;

/** A lift PR by default (`exerciseId` set); pass `exerciseId: null` for a
 *  benchmark-workout PR. */
export function personalRecord(
  overrides: Partial<PersonalRecordResponse> = {},
): PersonalRecordResponse {
  prSeq += 1;
  return {
    id: `pr_${prSeq}`,
    userId: 'user_test',
    exerciseId: `ex_${prSeq}`,
    exerciseName: `Exercise ${prSeq}`,
    workoutId: null,
    workoutName: null,
    displayName: `Exercise ${prSeq}`,
    value: '100',
    unit: 'kg',
    repScheme: null,
    achievedAt: '2026-07-01T10:00:00.000Z',
    workoutResultId: null,
    ...overrides,
  } as PersonalRecordResponse;
}

/** An active subscription with a joined plan, as `/subscriptions/my` returns. */
export function subscriptionWithPlan(
  overrides: Partial<SubscriptionWithPlan> = {},
): SubscriptionWithPlan {
  return {
    id: 'sub_test',
    membershipId: 'mem_test',
    planId: 'plan_test',
    status: 'active',
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    remainingCredits: null,
    pausedAt: null,
    debtAmountInCents: null,
    debtSince: null,
    failedChargeAttempts: 0,
    cancelAtPeriodEnd: false,
    cancellationReason: null,
    cancellationRequestedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    plan: {
      id: 'plan_test',
      organizationId: TEST_ORG,
      name: 'Gold Unlimited',
      description: null,
      type: 'unlimited',
      programId: null,
      priceInCents: 45000,
      currency: 'ILS',
      interval: 'month',
      classCredits: null,
      maxBookingsPerDay: null,
      maxBookingsPerWeek: null,
      allowOverlappingBookings: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      providerPriceId: null,
    },
    ...overrides,
  } as SubscriptionWithPlan;
}

/** A two-day curriculum: day 0 has one workout, day 1 is rest. */
export function courseDays(): CourseDay[] {
  return [
    {
      dayOffset: 0,
      isRest: false,
      workouts: [
        {
          id: 'cw_1',
          workoutId: 'w_course_1',
          isRest: false,
          sortOrder: 0,
          workout: {
            id: 'w_course_1',
            title: 'Foundations A',
            description: 'Technique focus',
          },
        },
      ],
    },
    { dayOffset: 1, isRest: true, workouts: [] },
  ];
}

/** An upcoming, bookable course meeting. */
export function courseSession(
  overrides: Partial<CourseSession> = {},
): CourseSession {
  return {
    id: 'cs_1',
    programId: 'prog_course_1',
    title: 'Kickoff meetup',
    description: null,
    // Far future so "upcoming" stays true without faking timers.
    startsAt: '2030-01-01T10:00:00.000Z',
    endsAt: null,
    locationId: null,
    locationName: null,
    locationText: 'Main studio',
    capacity: 10,
    status: 'published',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    bookedCount: 3,
    myRsvpStatus: null,
    ...overrides,
  };
}

/** An owned course as `/me/courses/:id` returns it (player payload —
 *  started, day 0 current, nothing completed). */
export function courseEntitlement(
  overrides: Partial<CourseEntitlement> = {},
): CourseEntitlement {
  return {
    id: 'ent_1',
    programId: 'prog_course_1',
    startDate: '2026-07-13',
    completedAt: null,
    restartCount: 0,
    accessRevokedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    course: {
      id: 'prog_course_1',
      name: 'Kettlebell Foundations',
      description: 'Six weeks of kettlebell basics',
      imageUrl: null,
      durationDays: 2,
    },
    organization: {
      id: TEST_ORG,
      name: 'Test Gym',
      slug: 'test-gym',
      logoUrl: null,
    },
    days: courseDays(),
    completedCourseWorkoutIds: [],
    currentDayOffset: 0,
    totalCompletedDays: 0,
    sessions: [],
    materials: [],
    ...overrides,
  };
}

/** GET /me/courses/:id/workouts/:workoutId payload. */
export function courseWorkoutDetail(
  overrides: Partial<CourseWorkoutDetail> = {},
): CourseWorkoutDetail {
  return {
    id: 'w_course_1',
    title: 'Foundations A',
    description: null,
    sections: [
      {
        id: 'cw_sec_1',
        type: 'strength',
        title: null,
        description: null,
        shape: null,
        config: null,
        sortOrder: 0,
        movements: [
          {
            id: 'cw_mv_1',
            sortOrder: 0,
            label: null,
            supersetGroup: null,
            prescription: null,
            notes: null,
            exercise: {
              id: 'ex_kb_swing',
              name: 'Kettlebell Swing',
              slug: 'kettlebell-swing',
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

let announcementSeq = 0;

export function announcement(
  overrides: Partial<AnnouncementResponse> = {},
): AnnouncementResponse {
  announcementSeq += 1;
  return {
    id: `ann_${announcementSeq}`,
    organizationId: TEST_ORG,
    authorId: 'user_coach',
    authorName: 'Coach Dana',
    authorRole: 'coach',
    title: `Announcement ${announcementSeq}`,
    content: 'Body text',
    priority: false,
    createdAt: '2026-07-01T10:00:00.000Z',
    readAt: null,
    readCount: 0,
    totalMembers: 10,
    ...overrides,
  };
}
