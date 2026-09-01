/**
 * The compliance sign screen, mounted inside the SHOP stack.
 *
 * A purchase gated on a regulation form used to hand the member to the
 * profile tab's copy of this screen — a native tab flip away from the plan
 * they were buying, and another one back. Registering the same screen here
 * keeps the whole sign-and-resume loop inside the shop tab. The screen
 * itself reads its params and behaves identically; only the address moved.
 */
export { default } from '../../profile/forms/[instanceId]';
