import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { analytics } from '@/lib/analytics';
import { useApiQuery, useApiAction } from './use-api-query';

/**
 * Mirrors `PendingIntentResponse` in @fitkit/shared. Declared locally because
 * mobile consumes the package from npm, and the type only ships after the
 * next release of it — swap this for the import once that lands.
 */
interface PendingIntent {
  id: string;
  kind: 'shop_plan';
  organizationId: string;
  planId: string | null;
}

interface PendingIntentEnvelope {
  data: PendingIntent | null;
}

/**
 * Recovers the destination a member was heading for before they left for the
 * App Store.
 *
 * App Links only fire on a *clicked* link, so a member who registers on the
 * web join page and then installs the app cold-starts with no URL at all — the
 * plan the whole funnel was carrying is gone and they land on the home tab.
 * The API records the destination against their account at hand-off (they have
 * already signed up by then, so we know who they are); this reads it back on
 * the first authenticated launch and routes them there.
 *
 * Only navigates once per launch, and only when the destination is reachable:
 * an org with no shop tab has nowhere to send them, so the intent is left
 * pending rather than consumed — it may become reachable later, and it expires
 * server-side either way.
 */
export function usePendingIntent(options: {
  /** Active org id — an intent for a different org is not ours to act on. */
  orgId: string | null | undefined;
  /** Whether the shop tab exists for this org. */
  shopAvailable: boolean;
  /**
   * Whether the tab navigator is actually mounted.
   *
   * Not the same condition as `shopAvailable`, which is what the first cut of
   * this got wrong: the shop gate needs only the plans and payment-config
   * queries, while the shell additionally waits on enrollments and programs.
   * In that window the layout is still rendering its loader, so there is no
   * `shop` route to replace onto — the navigation went nowhere and the member
   * stayed on home with the intent already burned.
   */
  navigatorReady: boolean;
}) {
  const { orgId, shopAvailable, navigatorReady } = options;
  const router = useRouter();
  const handledRef = useRef(false);

  const { data } = useApiQuery<PendingIntentEnvelope>({
    path: '/users/me/pending-intent',
    queryOptions: {
      // A one-shot launch hint: refetching it would risk re-firing a
      // navigation the member has already been given.
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  const { mutate: consume } = useApiAction({
    path: (id: string) => `/users/me/pending-intent/${id}/consume`,
  });

  const intent = data?.data ?? null;

  useEffect(() => {
    if (handledRef.current || !intent || !orgId) return;
    if (intent.kind !== 'shop_plan' || !intent.planId) return;
    // Someone else's org (multi-org member): leave it for a launch where that
    // org is active rather than switching under them.
    if (intent.organizationId !== orgId) return;
    if (!shopAvailable) return;
    // Nothing to navigate onto yet. Returning without latching leaves the
    // effect free to run again once the shell is up.
    if (!navigatorReady) return;

    handledRef.current = true;
    analytics.track('member_pending_intent_resumed', {
      org_id: orgId,
      plan_id: intent.planId,
      kind: intent.kind,
    });
    // The shop's existing `?plan=` landing takes it from here: spotlight the
    // plan and confirm before purchase, never auto-checkout.
    router.replace(`/(tabs)/shop?plan=${encodeURIComponent(intent.planId)}`);
    // Marked handled as soon as it has been acted on, so a later launch
    // doesn't drag the member back into a checkout they already saw.
    consume(intent.id);
  }, [intent, orgId, shopAvailable, navigatorReady, router, consume]);
}
