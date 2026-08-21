import { hasMemberAction, memberActionsOf } from '../member-actions';

/**
 * `memberAction` (singular) could only ever name ONE action, which is how a
 * `pending` checkout ended up offering either "finish paying" or "cancel",
 * never both. The plural field is authoritative; the fallback exists because
 * a deployed API build may still send only the singular, and behaviour there
 * must not change.
 */
describe('memberActionsOf', () => {
  it('prefers the server list when it is present', () => {
    expect(
      memberActionsOf({
        memberAction: 'cancel_pending',
        memberActions: ['complete_checkout', 'cancel_pending'],
      }),
    ).toEqual(['complete_checkout', 'cancel_pending']);
  });

  it('falls back to the legacy singular action', () => {
    expect(memberActionsOf({ memberAction: 'renew' })).toEqual(['renew']);
  });

  it('treats "none" as no action at all', () => {
    expect(memberActionsOf({ memberAction: 'none' })).toEqual([]);
    expect(memberActionsOf({ memberActions: ['none'] })).toEqual([]);
  });

  it('returns nothing for a row that carries neither field', () => {
    expect(memberActionsOf({})).toEqual([]);
    expect(memberActionsOf(null)).toEqual([]);
    expect(memberActionsOf(undefined)).toEqual([]);
  });

  it('answers membership questions through the same source', () => {
    const scheduled = { memberAction: 'none', memberActions: ['withdraw_scheduled'] };
    expect(hasMemberAction(scheduled, 'withdraw_scheduled')).toBe(true);
    expect(hasMemberAction(scheduled, 'renew')).toBe(false);
  });
});
