/**
 * renderWithProviders — mounts UI inside the same provider stack the app
 * uses (i18n, active org, react-query, safe area), minus the pieces that
 * are globally mocked (Clerk, analytics). Defaults mirror production:
 * Hebrew locale, a signed-in member of one org.
 *
 * Query retries are off and garbage collection is disabled so tests
 * exercise real fetch → loading → data/error transitions deterministically.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Locale } from '@/i18n/config';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';

export const TEST_ORG = 'org_test';

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    // gcTime: Infinity on BOTH: a finite gcTime schedules a garbage-collect
    // setTimeout (default 5min) that holds the Jest process open after the
    // test finishes.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

// RNTL v14: render is async — always `await renderWithProviders(...)`.
export async function renderWithProviders(
  ui: ReactElement,
  {
    lang = 'he',
    orgId = TEST_ORG,
    queryClient = makeTestQueryClient(),
  }: {
    /** `null` mounts with NO in-app override, so the provider falls back to
     *  the device locale — the path a fresh install takes. */
    lang?: Locale | null;
    orgId?: string | null;
    queryClient?: QueryClient;
  } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider>
        <I18nProvider initialOverride={lang}>
          <ActiveOrgProvider initialActiveOrgId={orgId}>
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </ActiveOrgProvider>
        </I18nProvider>
      </SafeAreaProvider>
    );
  }
  const result = await render(ui, { wrapper: Wrapper });
  return { queryClient, ...result };
}
