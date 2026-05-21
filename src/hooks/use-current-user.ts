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
  isLoading: boolean;
  isError: boolean;
}

/**
 * Mirrors apps/web/src/hooks/use-current-user.ts. The web version exposes
 * extra onboarding flags (isProfileIncomplete, needsLegalConsent) — those
 * land in mobile when we wire the corresponding screens (Phase 1.5+).
 */
export function useCurrentUser(): CurrentUserContext {
  const { data, isLoading: queryLoading, isError } = useApiQuery<UserMeResponse>(
    { path: '/users/me' },
  );
  const { isLoaded } = useClerkUser();

  const user = data?.data ?? null;
  const memberships = user?.memberships ?? [];
  const activeMemberships = memberships.filter((m) => m.status === 'active');

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
    isLoading: queryLoading || !isLoaded,
    isError,
  };
}
