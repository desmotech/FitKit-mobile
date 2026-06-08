/**
 * Localized membership-role label from the shared `invite` namespace
 * (`roleOwner` / `roleCoach` / `roleAdmin` / `roleMember`). Falls back to the
 * raw role string for unknown roles.
 */
export function roleLabel(role: string | null | undefined, t: unknown): string {
  if (!role) return '';
  const invite =
    (t as Record<string, Record<string, string>> | undefined)?.invite ?? {};
  const key = `role${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  return invite[key] ?? role;
}
