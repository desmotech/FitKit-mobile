/**
 * Fires a PostHog `$screen` event on every route change, mirroring
 * apps/web's PostHogPageView (`$pageview`). Mounted once near the root
 * (in `_layout.tsx`). No-op when PostHog is disabled.
 */
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { screen } from '@/lib/analytics';

export function useScreenTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) screen(pathname);
  }, [pathname]);
}
