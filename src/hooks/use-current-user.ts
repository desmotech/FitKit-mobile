import { useUser as useClerkUser } from '@clerk/clerk-expo';
import type {
  MembershipResponse,
  UserWithMembershipsResponse,
} from '@fitkit/shared';
import { useActiveOrg } from '@/providers/active-org-provider';
import { useApiQuery } from './use-api-query';

const ROLE_ORDER: MembershipResponse['role'][] = [
  'owner',
  'admin',
  'coach',
  'member',
];

/**
 * Resolves the user's active membership. An explicitly selected org (the
 * switcher) wins when it still matches an active membership; otherwise falls
 * back to the highest-privilege active membership. Mirrors
 * apps/web/src/lib/active-org.ts in the web app.
 */
export function pickActiveMembership(
  memberships: MembershipResponse[],
  preferredOrgId?: string | null,
): MembershipResponse | null {
  const active = memberships.filter((m) => m.status === 'active');
  if (!active.length) return null;
  if (preferredOrgId) {
    const preferred = active.find((m) => m.organizationId === preferredOrgId);
    if (preferred) return preferred;
  }
  return active.reduce((best, m) =>
    ROLE_ORDER.indexOf(m.role) < ROLE_ORDER.indexOf(best.role) ? m : best,
  );
}

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
  const { activeOrgId } = useActiveOrg();

  const user = data?.data ?? null;
  const memberships = user?.memberships ?? [];
  const activeMemberships = memberships.filter((m) => m.status === 'active');
  const pendingMemberships = memberships.filter(
    (m) => m.status === 'pending_invitation' || m.status === 'invited',
  );

  const primaryMembership = pickActiveMembership(memberships, activeOrgId);

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
