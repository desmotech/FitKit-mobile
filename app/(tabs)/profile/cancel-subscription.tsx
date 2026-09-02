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
 * Reached from the Payments screen's subscription card — which only ever
 * offers it for a live subscription (active/past_due/debt), never a `pending`
 * checkout: that one has its own cancel-pending path, and the API refuses a
 * notice on it outright since a checkout that never activated has no
 * membership to give a month's notice on.
 *
 * When the org publishes a `membership_cancellation` form, the API answers
 * with its instance id and this hands the member straight to signing it. That
 * is a courtesy, not a gate — the cancellation committed server-side before
 * the response came back, so abandoning the form changes nothing about it.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { FKActionBar, FKBtn, FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import { useCancelAtPeriodEnd } from '@/hooks/use-feed-data';
import { useFormStrings } from '@/i18n/use-form-strings';
import {
  cancelReasonChips,
  type CancelReasonCode,
} from '@/i18n/cancel-reason-strings';
import { useCancelReasonStrings } from '@/i18n/use-cancel-reason-strings';
import { useHaptics } from '@/hooks/use-haptics';
import * as analytics from '@/lib/analytics';
import { autofill } from '@/lib/autofill';
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
  const formStrings = useFormStrings();
  const reasonStrings = useCancelReasonStrings();
  const reasonChips = useMemo(
    () => cancelReasonChips(reasonStrings),
    [reasonStrings],
  );

  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<CancelReasonCode | null>(null);

  // Funnel events (member_cancel_dialog_*): opened once the sheet has an
  // org/subscription to act on, abandoned on any dismissal that never
  // reached a submit, confirmed on a successful notice. `submittedRef` is
  // set the moment the member taps confirm — an error still counts as a
  // submit attempt, not an abandonment, so a retry-then-leave doesn't
  // double-report.
  const openedRef = useRef(false);
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current && orgId && subId) {
      openedRef.current = true;
      analytics.track('member_cancel_dialog_opened', {
        org_id: orgId,
        subscription_id: subId,
      });
    }
    return () => {
      if (openedRef.current && !submittedRef.current) {
        analytics.track('member_cancel_dialog_abandoned', {
          org_id: orgId,
          subscription_id: subId,
        });
      }
    };
    // Fires once on mount / once on unmount — org and subscription id are
    // fixed for the life of this sheet.
  }, [orgId, subId]);

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
      close: get(t, 'common.close') ?? 'Close',
      confirm: get(t, cd + 'confirmPeriodEnd') ?? 'Cancel membership',
      scheduled:
        get(t, cd + 'periodEndScheduled') ??
        'Your membership will end on {date}',
      scheduledSignForm:
        get(t, cd + 'periodEndScheduledSignForm') ??
        'Your membership will end on {date}. One last step: sign the cancellation form.',
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
    // Tapping confirm is what makes this a submit, whatever the outcome —
    // an error retry-then-leave must not also read as an abandoned dialog.
    submittedRef.current = true;
    const trimmed = reason.trim();
    try {
      // Optional: send a reason / reasonCode only when there is one, rather
      // than pushing an empty string or null the API would have to
      // interpret. The two are independent — a member may pick a chip,
      // write free text, both, or neither.
      const result = await cancelMut.mutateAsync({
        id: subId,
        ...(trimmed ? { reason: trimmed } : {}),
        ...(reasonCode ? { reasonCode } : {}),
      });

      // The end date is the server's answer, computed from the notice — never
      // derived here from a billing period, which is a different date.
      const effectiveAt = result?.data?.cancellationEffectiveAt;
      // The gym's written cancellation form, when it publishes one and the
      // org has `cancellation-form-prompt` on. Null (the common case) keeps
      // the plain confirm-and-dismiss this screen has always done.
      const formInstanceId = result?.data?.cancellationFormInstanceId;

      const dateStr = effectiveAt
        ? new Date(effectiveAt).toLocaleDateString(lang, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : null;
      const body = dateStr
        ? (formInstanceId ? L.scheduledSignForm : L.scheduled).replace(
            '{date}',
            dateStr,
          )
        : L.title;

      haptics.success();
      analytics.track('member_cancel_confirmed', {
        org_id: orgId,
        subscription_id: subId,
        reason_code: reasonCode ?? undefined,
        has_form: !!formInstanceId,
      });
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
        });
      }

      if (formInstanceId) {
        // Navigate on the alert's own dismissal rather than alongside it: the
        // sheet is still up while the alert shows, and this codebase has been
        // bitten twice by navigations racing a transition (the shop's spent
        // intent, the tab replace-vs-navigate fix). `dismissTo` is one atomic
        // action — the form route isn't in this stack, so it replaces the
        // sheet — leaving Back on the form returning to Payments.
        Alert.alert('', body, [
          {
            text: formStrings.signCancellationNow,
            onPress: () =>
              router.dismissTo({
                pathname: '/(tabs)/profile/forms/[instanceId]',
                params: { instanceId: formInstanceId, reason: 'cancellation' },
              }),
          },
        ]);
        return;
      }

      Alert.alert('', body);
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert(
        '',
        paymentErrorMessage(
          errorStrings,
          e,
          lang,
          L.error,
          'subscription-cancel',
        ),
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={L.title}
        leadingAction={{
          label: L.close,
          onPress: () => router.back(),
          disabled: submitting,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
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
                color: colors.mutedFg,
                fontFamily: 'Assistant-Medium',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {L.reasonLabel}
            </Text>

            {/* Optional — a chip never blocks the confirm button, same as
                the free-text field below. Tapping a selected chip again
                clears it: at most one reason code, or none. */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {reasonChips.map(({ code, label }) => {
                const selected = reasonCode === code;
                return (
                  <Pressable
                    key={code}
                    testID={`cancel-reason-chip-${code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      haptics.select();
                      setReasonCode((prev) => (prev === code ? null : code));
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected
                        ? BRAND_TEAL
                        : isDark
                          ? 'rgba(255,255,255,0.14)'
                          : 'rgba(15,23,42,0.12)',
                      backgroundColor: selected
                        ? BRAND_TEAL + '1F'
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: selected ? BRAND_TEAL : colors.mutedFg,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ position: 'relative' }}>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={L.reasonPlaceholder}
                placeholderTextColor={colors.mutedFg}
                {...autofill('off')}
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

        {/* Stacked, not side by side: both labels are whole sentences in
            Hebrew and would wrap into two-line slabs sharing a row. No `full`
            either — `flex: 1` in an auto-height column collapses to zero. */}
        <FKActionBar>
          <View style={{ flex: 1, gap: 10 }}>
            <FKBtn
              variant="danger"
              label={L.confirm}
              onPress={handleSubmit}
              disabled={!canSubmit}
            />
            <FKBtn
              variant="ghost"
              label={L.keep}
              onPress={() => router.back()}
              disabled={submitting}
            />
          </View>
        </FKActionBar>
      </KeyboardAvoidingView>
    </View>
  );
}
