import {
  QueryClient,
  keepPreviousData,
  onlineManager,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const ONE_MINUTE = 60_000;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const TWENTY_FOUR_HOURS = 24 * 60 * ONE_MINUTE;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'fitkit-rq-cache',
  throttleTime: 1_000,
});

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: ONE_MINUTE,
            gcTime: THIRTY_MINUTES,
            placeholderData: keepPreviousData,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Refetch when app returns to foreground.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        onlineManager.setOnline(true);
        queryClient.invalidateQueries();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: TWENTY_FOUR_HOURS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
