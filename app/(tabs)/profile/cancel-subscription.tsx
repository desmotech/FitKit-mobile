/**
 * Cancel-subscription pageSheet — mobile port of web's
 * `cancel-subscription-dialog`. Two paths:
 *   1. `period_end` — POST `…/cancel-at-period-end`; reversible via "Keep my
 *      subscription" (resume) until the period ends.
 *   2. `immediate_with_refund` — POST `…/cancellation-requests`; opens a
 *      request for the gym owner to review (member is notified by email).
 *
 * Both require a reason. Reached from the Payments screen's subscription card.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, CalendarClock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useCancelAtPeriodEnd,
  useRequestCancellation,
} from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

type CancellationKind = 'period_end' | 'immediate_with_refund';
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

  const params = useLocalSearchParams<{
    id?: string;
    plan?: string;
    periodEnd?: string;
  }>();
  const subId = typeof params.id === 'string' ? params.id : undefined;
  const planName = typeof params.plan === 'string' ? params.plan : '';

  const cancelMut = useCancelAtPeriodEnd(orgId);
  const requestMut = useRequestCancellation(orgId);

  const [kind, setKind] = useState<CancellationKind>('period_end');
  const [reason, setReason] = useState('');

  const formattedEndDate = params.periodEnd
    ? new Date(params.periodEnd).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const L = useMemo(() => {
    const cd = 'subscriptions.cancelDialog.';
    return {
      title: get(t, cd + 'title') ?? 'Cancel subscription',
      description:
        get(t, cd + 'description') ??
        'Cancel your {plan} subscription. Tell us why so we can improve.',
      optionPeriodEnd:
        get(t, cd + 'optionPeriodEnd') ?? 'Cancel at end of current period',
      optionPeriodEndDesc:
        get(t, cd + 'optionPeriodEndDesc') ??
        'Your subscription continues until {date}, then ends automatically. Reversible until then.',
      optionImmediate:
        get(t, cd + 'optionImmediate') ?? 'Cancel now and request a refund',
      optionImmediateDesc:
        get(t, cd + 'optionImmediateDesc') ??
        "Sends a request to the gym for review. They'll get back to you by email.",
      reasonLabel: get(t, cd + 'reasonLabel') ?? 'Reason for canceling',
      reasonPlaceholder:
        get(t, cd + 'reasonPlaceholder') ?? "Tell us what's going on…",
      reasonRequired:
        get(t, cd + 'reasonRequired') ?? 'Please tell us your reason',
      keep: get(t, cd + 'cancelAction') ?? 'Keep subscription',
      confirmPeriodEnd:
        get(t, cd + 'confirmPeriodEnd') ?? 'Schedule cancellation',
      confirmRequest: get(t, cd + 'confirmRequest') ?? 'Submit request',
      periodEndScheduled:
        get(t, cd + 'periodEndScheduled') ??
        'Cancellation scheduled for {date}',
      requestSubmitted:
        get(t, cd + 'requestSubmitted') ??
        "Your request has been submitted. We'll email you when it's resolved.",
      error:
        get(t, cd + 'error') ??
        "Couldn't process your cancellation. Please try again.",
    };
  }, [t]);

  const trimmed = reason.trim();
  const submitting = cancelMut.isPending || requestMut.isPending;
  const canSubmit = !!trimmed && !!subId && !submitting;
  const remaining = MAX_LENGTH - reason.length;
  const confirmLabel =
    kind === 'period_end' ? L.confirmPeriodEnd : L.confirmRequest;

  const handleSubmit = async () => {
    if (!canSubmit || !subId) {
      if (!trimmed) Alert.alert('', L.reasonRequired);
      return;
    }
    haptics.tap();
    try {
      if (kind === 'period_end') {
        await cancelMut.mutateAsync({ id: subId, reason: trimmed });
        Alert.alert(
          '',
          L.periodEndScheduled.replace('{date}', formattedEndDate),
        );
      } else {
        await requestMut.mutateAsync({
          id: subId,
          reason: trimmed,
          refundRequested: true,
        });
        Alert.alert('', L.requestSubmitted);
      }
      haptics.success();
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
        });
      }
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert('', e instanceof Error ? e.message : L.error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={L.title}
        leadingAction={{ label: L.keep, onPress: () => router.back() }}
        trailingAction={{
          label: confirmLabel,
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

          <View style={{ gap: 10 }}>
            <OptionCard
              icon={CalendarClock}
              title={L.optionPeriodEnd}
              desc={L.optionPeriodEndDesc.replace('{date}', formattedEndDate)}
              accent={BRAND_TEAL}
              selected={kind === 'period_end'}
              isDark={isDark}
              colors={colors}
              isRTL={isRTL}
              onPress={() => {
                haptics.select();
                setKind('period_end');
              }}
            />
            <OptionCard
              icon={Banknote}
              title={L.optionImmediate}
              desc={L.optionImmediateDesc}
              accent={DESTRUCTIVE}
              selected={kind === 'immediate_with_refund'}
              isDark={isDark}
              colors={colors}
              isRTL={isRTL}
              onPress={() => {
                haptics.select();
                setKind('immediate_with_refund');
              }}
            />
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

function OptionCard({
  icon: Icon,
  title,
  desc,
  accent,
  selected,
  isDark,
  colors,
  isRTL,
  onPress,
}: {
  icon: typeof CalendarClock;
  title: string;
  desc: string;
  accent: string;
  selected: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useFKColors>;
  isRTL: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: selected
              ? accent
              : isDark
                ? 'rgba(255,255,255,0.10)'
                : 'rgba(15,23,42,0.10)',
            backgroundColor: selected
              ? accent + '14'
              : isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(15,23,42,0.02)',
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <Icon
            size={18}
            color={selected ? accent : colors.mutedFg}
            strokeWidth={2.2}
            style={{ marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: selected ? accent : colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedFg,
                marginTop: 3,
                lineHeight: 17,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {desc}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
