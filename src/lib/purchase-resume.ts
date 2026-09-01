/**
 * One-shot hand-off between the compliance sign screen and the shop.
 *
 * When a purchase was stopped by a 409 `form_signature_required` gate, the
 * member has already tapped Purchase — making them re-confirm on the way
 * back ("Sign up for {plan}?") was a second ask for a decision they already
 * made, and every extra prompt on this path costs real purchases.
 *
 * The flag lives in module memory, NOT in the `?plan=` route params, on
 * purpose: params ride URL-space, so a crafted `taikan://shop?...` deep
 * link could otherwise mint a payment session without any tap. An external
 * link can never arm this; only the sign screen's own code path can. The
 * shop's deep-link landing consumes it exactly once, and anything armed but
 * never consumed dies after a short TTL so a failed navigation can't leave
 * a live auto-checkout behind for a later unrelated landing.
 */
const TTL_MS = 30_000;

let armedPlanId: string | null = null;
let armedAt = 0;

/** Called by the sign screen when it hands a gated purchase back. */
export function armPurchaseResume(planId: string): void {
  armedPlanId = planId;
  armedAt = Date.now();
}

/**
 * True exactly once per arm, and only for the plan that was armed within
 * the TTL. Any call clears the flag — a mismatched or expired landing must
 * not leave a live one behind.
 */
export function consumePurchaseResume(planId: string): boolean {
  const hit =
    armedPlanId === planId && Date.now() - armedAt <= TTL_MS;
  armedPlanId = null;
  return hit;
}
