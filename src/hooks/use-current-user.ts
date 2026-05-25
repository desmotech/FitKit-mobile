import { useUser as useClerkUser } from '@clerk/clerk-expo';
import type {
  MembershipResponse,
  UserWithMembershipsResponse,
} from '@fitkit/shared';
import { useApiQuery } from './use-api-query';

interface UserMeResponse {
  data: UserWithMembershipsResponse;
}

export type MembershipRole = MembershipResponse['role'];

export interface CurrentUserContext {
  user: UserWithMembershipsResponse | null;
  memberships: MembershipResponse[];
  primaryMembership: MembershipResponse | null;
  primaryRole: MembershipRole | null;
  activeOrganization: MembershipResponse['organization'] | null;
  isMember: boolean;
  isCoach: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  /** True when user has zero memberships — fresh sign-up. */
  isNewUser: boolean;
  /** True when user has memberships but none are active (only pending invites). */
  hasPendingMembership: boolean;
  /** True when user is signed in + has an active membership but profile is not yet
   *  filled in (name / phone / national-id / birth-date). Gates /complete-profile. */
  isProfileIncomplete: boolean;
  /** True when user is signed in + active member, but the platform has new
   *  legal document versions awaiting acceptance. Gates /accept-terms. */
  needsLegalConsent: boolean;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Mirrors apps/web/src/hooks/use-current-user.ts — including the
 * onboarding gate derivations (isNewUser, hasPendingMembership,
 * isProfileIncomplete, needsLegalConsent) that the AuthGate consumes
 * to route the user through the legal/profile onboarding screens
 * before letting them into the tab shell.
 */
export function useCurrentUser(): CurrentUserContext {
  const { data, isLoading: queryLoading, isError } = useApiQuery<UserMeResponse>(
    { path: '/users/me' },
  );
  const { isLoaded } = useClerkUser();

  const user = data?.data ?? null;
  const memberships = user?.memberships ?? [];
  const activeMemberships = memberships.filter((m) => m.status === 'active');
  const pendingMemberships = memberships.filter(
    (m) => m.status === 'pending_invitation' || m.status === 'invited',
  );

  const roleOrder: MembershipRole[] = ['owner', 'admin', 'coach', 'member'];
  const primaryMembership =
    activeMemberships.length > 0
      ? activeMemberships.reduce((best, m) => {
          const bestIdx = roleOrder.indexOf(best.role);
          const currIdx = roleOrder.indexOf(m.role);
          return currIdx < bestIdx ? m : best;
        })
      : null;

  const primaryRole = primaryMembership?.role ?? null;
  const isLoading = queryLoading || !isLoaded;

  return {
    user,
    memberships,
    primaryMembership,
    primaryRole,
    activeOrganization: primaryMembership?.organization ?? null,
    isOwner: primaryRole === 'owner',
    isAdmin: primaryRole === 'admin',
    isCoach: primaryRole === 'coach',
    isMember: primaryRole === 'member',
    isNewUser: !isLoading && memberships.length === 0,
    hasPendingMembership:
      !isLoading &&
      activeMemberships.length === 0 &&
      pendingMemberships.length > 0,
    isProfileIncomplete:
      !isLoading &&
      !!user &&
      activeMemberships.length > 0 &&
      user.profileComplete === false,
    needsLegalConsent:
      !isLoading &&
      !!user &&
      activeMemberships.length > 0 &&
      user.pendingLegalConsents === true,
    isLoading,
    isError,
  };
}
