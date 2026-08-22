import { useUser as useClerkUser } from '@clerk/clerk-expo';
import type {
  MembershipResponse,
  UserWithMembershipsResponse,
} from '@taikan/shared';
import { useActiveOrg } from '@/providers/active-org-provider';
import { OFFLINE_GC_TIME } from '@/lib/query-persister';
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
  /** True when user has memberships but none are active or pending — the
   *  client was cancelled/suspended (or soft-deleted) by the gym. Gates the
   *  membership-inactive screen instead of the tab shell. */
  isMembershipInactive: boolean;
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
  // Long-lived on purpose: this payload is what the boot gate needs before
  // anything else can render, so if it is not in the restored cache an
  // offline launch cannot get past AuthGate — and the schedule cached for
  // exactly that moment is unreachable. At the app-wide 30-minute gcTime,
  // offline booking only worked within half an hour of last use.
  const { data, isLoading: queryLoading, isError } = useApiQuery<UserMeResponse>(
    { path: '/users/me', queryOptions: { gcTime: OFFLINE_GC_TIME } },
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
    isMembershipInactive:
      !isLoading &&
      memberships.length > 0 &&
      activeMemberships.length === 0 &&
      pendingMemberships.length === 0,
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
