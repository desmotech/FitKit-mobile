/**
 * What the member may do with a subscription, as resolved server-side.
 *
 * `memberAction` (singular) is the legacy field: one action, which forced the
 * API to pick a winner when a row genuinely offers two — a `pending` checkout
 * can be completed OR rolled back, and returning only `cancel_pending` left
 * the member with no way to finish paying. `memberActions` (plural) is the
 * authoritative list; the singular stays on the wire for app builds that
 * shipped before it.
 *
 * Read through {@link memberActionsOf} rather than off the row: mobile's
 * pinned `@taikan/shared` predates both fields, so both are typed
 * structurally, and the fallback keeps an older API deployment behaving
 * exactly as it did.
 */

export type MemberSubscriptionAction =
  | 'none'
  | 'renew'
  | 'complete_checkout'
  | 'cancel_pending'
  | 'update_card'
  | 'withdraw_scheduled';

/** The subset of a subscription row this module reads. */
export interface WithMemberActions {
  memberAction?: string | null;
  memberActions?: string[] | null;
}

/**
 * Every action the member may take on this row.
 *
 * Prefers the server's `memberActions` array. Falls back to the single
 * `memberAction` (older API build), and to `[]` when neither is present or
 * the only action is the explicit `'none'`.
 */
export function memberActionsOf(
  sub: WithMemberActions | null | undefined,
): MemberSubscriptionAction[] {
  if (!sub) return [];
  const list = Array.isArray(sub.memberActions)
    ? sub.memberActions
    : sub.memberAction
      ? [sub.memberAction]
      : [];
  return list.filter((a): a is MemberSubscriptionAction => a !== 'none');
}

/** Does the member have this action available on the row? */
export function hasMemberAction(
  sub: WithMemberActions | null | undefined,
  action: MemberSubscriptionAction,
): boolean {
  return memberActionsOf(sub).includes(action);
}
