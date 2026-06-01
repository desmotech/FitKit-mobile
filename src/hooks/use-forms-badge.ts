import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useIncompleteFormsCount } from './use-forms';

// Keeps the iOS app-icon badge in sync with the number of forms awaiting
// the member's action.
export function useFormsBadge(orgId: string | undefined | null) {
  const count = useIncompleteFormsCount(orgId);
  useEffect(() => {
    Notifications.setBadgeCountAsync(count).catch(() => undefined);
  }, [count]);
}
