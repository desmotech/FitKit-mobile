/**
 * pickActiveMembership decides which gym the member lands in after sign-in
 * and after switching orgs — the wrong pick shows another gym's data.
 */
import type { MembershipResponse } from '@fitkit/shared';
import { pickActiveMembership } from '../use-current-user';

function m(
  orgId: string,
  role: MembershipResponse['role'],
  status: MembershipResponse['status'] = 'active',
): MembershipResponse {
  return {
    id: `mem_${orgId}_${role}`,
    organizationId: orgId,
    role,
    status,
    organization: { id: orgId, name: orgId },
  } as MembershipResponse;
}

describe('pickActiveMembership', () => {
  it('honors the org the member explicitly selected', () => {
    const picked = pickActiveMembership(
      [m('org_a', 'owner'), m('org_b', 'member')],
      'org_b',
    );
    expect(picked?.organizationId).toBe('org_b');
  });

  it('falls back to the highest-privilege org when the selection is stale', () => {
    const picked = pickActiveMembership(
      [m('org_a', 'member'), m('org_b', 'coach')],
      'org_gone',
    );
    expect(picked?.organizationId).toBe('org_b');
  });

  it('never lands the member in an org they only have a pending invite to', () => {
    const picked = pickActiveMembership(
      [m('org_a', 'member'), m('org_b', 'owner', 'pending_invitation')],
      'org_b',
    );
    expect(picked?.organizationId).toBe('org_a');
  });

  it('returns null for a fresh sign-up with no active membership', () => {
    expect(pickActiveMembership([], null)).toBeNull();
    expect(
      pickActiveMembership([m('org_a', 'member', 'pending_invitation')], null),
    ).toBeNull();
  });

  it('prefers owner > admin > coach > member with no explicit selection', () => {
    const picked = pickActiveMembership(
      [m('org_a', 'member'), m('org_b', 'admin'), m('org_c', 'coach')],
      null,
    );
    expect(picked?.organizationId).toBe('org_b');
  });
});
