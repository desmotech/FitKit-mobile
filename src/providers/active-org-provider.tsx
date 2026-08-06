/**
 * ActiveOrgProvider — the user's explicitly selected organization.
 *
 * Mirrors the theme/locale pattern: the persisted value is preloaded in
 * app/_layout.tsx behind the splash (no wrong-org first frame), lives in
 * React state here, and every change is written back to AsyncStorage.
 *
 * `activeOrgId === null` means "no explicit selection" — use-current-user
 * then falls back to the highest-privilege active membership, which was the
 * sole behavior before multi-org switching existed. A stale id (org the user
 * left) falls back the same way, so the value never needs server validation.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { clearActiveOrgId, saveActiveOrgId } from '@/lib/settings-store';

type ActiveOrgValue = {
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string) => void;
  /**
   * Drops the selection from memory *and* from disk. Clearing only the
   * stored value isn't enough: this state is seeded once at startup, so a
   * sign-out that doesn't reset it leaves the next user signing in on this
   * device pinned to the previous user's org for the rest of the app run.
   */
  clearActiveOrg: () => void;
};

const ActiveOrgContext = createContext<ActiveOrgValue | null>(null);

export function ActiveOrgProvider({
  initialActiveOrgId,
  children,
}: {
  initialActiveOrgId: string | null;
  children: ReactNode;
}) {
  const [activeOrgId, setState] = useState<string | null>(initialActiveOrgId);

  const setActiveOrgId = useCallback((orgId: string) => {
    setState(orgId);
    void saveActiveOrgId(orgId);
  }, []);

  const clearActiveOrg = useCallback(() => {
    setState(null);
    void clearActiveOrgId();
  }, []);

  const value = useMemo(
    () => ({ activeOrgId, setActiveOrgId, clearActiveOrg }),
    [activeOrgId, setActiveOrgId, clearActiveOrg],
  );

  return (
    <ActiveOrgContext.Provider value={value}>
      {children}
    </ActiveOrgContext.Provider>
  );
}

export function useActiveOrg(): ActiveOrgValue {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) {
    throw new Error('useActiveOrg must be used within an ActiveOrgProvider');
  }
  return ctx;
}
