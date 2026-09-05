/**
 * API response factories for MSW handlers. Shapes mirror the @taikan/shared
 * response schemas; overrides let each test state only what it cares about.
 */
import type {
  AnnouncementResponse,
  ConversationResponse,
  MembershipResponse,
  PersonalRecordResponse,
  SubscriptionWithPlan,
  UserWithMembershipsResponse,
} from '@taikan/shared';
import { api, http, HttpResponse, server } from './msw';
import { TEST_ORG } from './render';

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
      type: 'subscription',
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
    createdAt: '2026-07-01T10:00:00.000Z',
    readAt: null,
    readCount: 0,
    totalMembers: 10,
    ...overrides,
  };
}
