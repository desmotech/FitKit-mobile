/**
 * Cancel-subscription pageSheet.
 *
 * One path, because there is only one: the member gives notice and the
 * membership ends one month later. Reversible via "Keep my subscription"
 * (resume) at any point before it takes effect.
 *
 * There used to be a second option that opened a `cancellation_requests` row
 * for the gym to approve or reject. That endpoint no longer exists — a
 * cancellation is a notice, not a request a gym can refuse. The reason field
 * stays because it is useful to the gym, but it never blocks: the member owes
 * their name and ID, nothing more.
 *
 * Reached from the Payments screen's subscription card.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { ApiError, useApi } from '@/hooks/use-api';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import { useCancelAtPeriodEnd } from '@/hooks/use-feed-data';
import { isFormActionable, type MyFormEntry } from '@/hooks/use-forms';
import { useHaptics } from '@/hooks/use-haptics';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

const MAX_LENGTH = 500;
const DESTRUCTIVE = '#B84A40';
const BRAND_TEAL = '#0E8C8C';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function CancelSubscriptionScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{ id?: string; plan?: string }>();
  const subId = typeof params.id === 'string' ? params.id : undefined;
  const planName = typeof params.plan === 'string' ? params.plan : '';

  const cancelMut = useCancelAtPeriodEnd(orgId);
  const errorStrings = usePaymentErrorStrings();
  const { fetchWithAuth } = useApi();

  const [reason, setReason] = useState('');

  const L = useMemo(() => {
    const cd = 'subscriptions.cancelDialog.';
    return {
      title: get(t, cd + 'title') ?? 'Cancel subscription',
      description:
        get(t, cd + 'description') ??
        'Cancel your {plan} subscription. Tell us why so we can improve.',
      oneMonthNotice:
        get(t, cd + 'oneMonthNotice') ??
        'Your membership ends one month from today. You keep full access until then, and you can undo this at any point before it takes effect.',
      reasonLabel:
        get(t, cd + 'reasonLabel') ?? 'Reason for canceling (optional)',
      reasonPlaceholder:
        get(t, cd + 'reasonPlaceholder') ?? "Tell us what's going on…",
      keep: get(t, cd + 'cancelAction') ?? 'Keep subscription',
      confirm: get(t, cd + 'confirmPeriodEnd') ?? 'Cancel membership',
      scheduled:
        get(t, cd + 'periodEndScheduled') ??
        'Your membership will end on {date}',
      error:
        get(t, cd + 'error') ??
        "Couldn't process your cancellation. Please try again.",
    };
  }, [t]);

  const submitting = cancelMut.isPending;
  const canSubmit = !!subId && !submitting;
  const remaining = MAX_LENGTH - reason.length;

  const handleSubmit = async () => {
    if (!canSubmit || !subId) return;
    haptics.tap();
    const trimmed = reason.trim();
    try {
      // Optional: send a reason only when there is one, rather than pushing an
      // empty string the API would have to interpret.
      const result = await cancelMut.mutateAsync(
        trimmed ? { id: subId, reason: trimmed } : { id: subId },
      );

      // The end date is the server's answer, computed from the notice — never
      // derived here from a billing period, which is a different date.
      const effectiveAt = (
        result as
          | { data?: { cancellationEffectiveAt?: string | null } }
          | undefined
      )?.data?.cancellationEffectiveAt;

      Alert.alert(
        '',
        effectiveAt
          ? L.scheduled.replace(
              '{date}',
              new Date(effectiveAt).toLocaleDateString(lang, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
            )
          : L.title,
      );
      haptics.success();
      if (!orgId) {
        router.back();
        return;
      }

      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
      });

      // The API issues a written cancellation form when notice is given — the
      // law wants the notice in writing, carrying the member's name and ID, and
      // a button press records neither. Take the member straight to it rather
      // than leaving a silent to-do behind a badge.
      //
      // Best-effort by design: it is a record, never a gate. If the gym has no
      // such form, or the fetch fails, the member is already cancelled and just
      // goes back.
      const instanceId = await findPendingCancellationForm(
        fetchWithAuth,
        queryClient,
        orgId,
      );
      if (instanceId) {
        router.replace({
          pathname: '/(tabs)/profile/forms/[instanceId]',
          params: { instanceId },
        });
        return;
      }
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert(
        '',
        e instanceof ApiError && e.code
          ? paymentErrorMessage(errorStrings, e, lang)
          : e instanceof Error
            ? e.message
            : L.error,
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={L.title}
        leadingAction={{ label: L.keep, onPress: () => router.back() }}
        trailingAction={{
          label: L.confirm,
          onPress: handleSubmit,
          style: 'destructive',
          disabled: !canSubmit,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 48,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 14,
              color: colors.mutedFg,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {L.description.replace('{plan}', planName)}
          </Text>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: BRAND_TEAL,
              backgroundColor: BRAND_TEAL + '14',
            }}
          >
            <CalendarClock
              size={18}
              color={BRAND_TEAL}
              strokeWidth={2.2}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: colors.foreground,
                lineHeight: 19,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {L.oneMonthNotice}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: colors.mutedFg,
                fontFamily: 'Assistant-Medium',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {L.reasonLabel}
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={L.reasonPlaceholder}
                placeholderTextColor={colors.mutedFg}
                multiline
                maxLength={MAX_LENGTH}
                style={{
                  minHeight: 120,
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 28,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(15,23,42,0.10)',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(15,23,42,0.04)',
                  color: colors.foreground,
                  fontSize: 15,
                  lineHeight: 21,
                  textAlign: isRTL ? 'right' : 'left',
                  textAlignVertical: 'top',
                }}
              />
              <Text
                style={{
                  position: 'absolute',
                  bottom: 8,
                  [isRTL ? 'left' : 'right']: 12,
                  fontSize: 11,
                  fontFamily: 'Assistant-Medium',
                  fontVariant: ['tabular-nums'],
                  color: remaining < 50 ? DESTRUCTIVE : colors.mutedFg,
                }}
              >
                {reason.length}/{MAX_LENGTH}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The cancellation form the API just issued, if the gym has one published.
 *
 * Fetches rather than reading cache: the instance was created moments ago by
 * the cancel call, and `/forms/mine` may never have been mounted in this
 * session at all. The result is seeded into the query cache so the forms list
 * and its badge are correct on the way out.
 */
async function findPendingCancellationForm(
  fetchWithAuth: (path: string) => Promise<unknown>,
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: string,
): Promise<string | null> {
  try {
    const res = (await fetchWithAuth(
      `/organizations/${orgId}/forms/mine`,
    )) as { data?: MyFormEntry[] } | undefined;
    const entries = res?.data ?? [];
    queryClient.setQueryData(queryKeys.forms.mine(orgId), { data: entries });

    const match = entries.find(
      (e) =>
        e.form?.typeKey === 'membership_cancellation' &&
        !e.instance?.archivedAt &&
        isFormActionable(e.instance?.status ?? ''),
    );
    return match?.instance?.id ?? null;
  } catch {
    // Never let paperwork discovery break the exit.
    return null;
  }
}
