/**
 * Switch-plan picker (FIT-271) — mobile port of web's
 * `switch-plan-picker-dialog.tsx`. Step 1 of the shop "Switch to this plan"
 * flow when the member holds MORE THAN ONE active recurring subscription:
 * choose which one to move onto the viewed plan. (With exactly one, the
 * shop skips straight to the change-plan sheet — same as web.)
 *
 * A slide-up modal on both platforms (rather than ActionSheetIOS) because
 * the picker needs a description line and per-option price — same visual
 * pattern as FKSelectSheet's Android fallback.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SubscriptionWithPlan } from '@fitkit/shared';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import { formatPrice } from '@/lib/format-price';
import { useFKColors } from '@/components/fk';
import { useI18n } from '@/providers/i18n-provider';

export function SwitchPlanPicker({
  open,
  subscriptions,
  onSelect,
  onClose,
}: {
  open: boolean;
  /** The member's active subscription-type subs (the switch candidates). */
  subscriptions: SubscriptionWithPlan[];
  onSelect: (subscription: SubscriptionWithPlan) => void;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const colors = useFKColors();
  const haptics = useHaptics();
  const strings = usePlanChangeStrings();
  const isDark = colors.isDark;
  const hairline = isDark
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(15,23,42,0.06)';

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          testID="switch-plan-picker"
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderCurve: 'continuous',
          }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: hairline,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.foreground,
                textAlign: 'center',
              }}
            >
              {strings.pickerTitle}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedFg,
                textAlign: 'center',
              }}
            >
              {strings.pickerDescription}
            </Text>
          </View>

          {subscriptions.map((sub) => (
            <Pressable
              key={sub.id}
              testID={`switch-plan-picker-option-${sub.id}`}
              onPress={() => {
                haptics.select();
                onSelect(sub);
              }}
              android_ripple={{
                color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.foreground,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {sub.plan.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {formatPrice(sub.plan.priceInCents, sub.plan.currency, lang)}
              </Text>
            </Pressable>
          ))}

          <SafeAreaView edges={['bottom']}>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: hairline,
              }}
            />
            <Pressable
              onPress={onClose}
              android_ripple={{
                color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
              style={{ paddingVertical: 16, alignItems: 'center' }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.foreground,
                }}
              >
                {strings.pickerCancel}
              </Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
