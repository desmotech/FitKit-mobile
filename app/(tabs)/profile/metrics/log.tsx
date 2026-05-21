/**
 * Log Body Metric — pageSheet form. Mirrors web's `MetricEntryDialog`
 * shape: one metric per save. Picks the type, the value, the unit
 * (auto-defaulted from type), date, optional notes. POSTs to the
 * existing `/organizations/:orgId/metrics/me` endpoint.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type {
  BodyMetricType,
  BodyMetricUnit,
  CreateBodyMetricInput,
} from '@fitkit/shared';
import {
  FKDateField,
  FKGlassPanel,
  FKModalHeader,
  FKSelectSheet,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useLogMetric } from '@/hooks/use-body-metrics';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const TYPE_ORDER: BodyMetricType[] = [
  'weight',
  'body_fat',
  'chest',
  'waist',
  'hips',
  'thigh',
  'arm',
  'custom',
];

/** Default unit per metric type — mirrors web's MetricEntryDialog. */
const DEFAULT_UNIT_FOR: Record<BodyMetricType, BodyMetricUnit> = {
  weight: 'kg',
  body_fat: 'percent',
  chest: 'cm',
  waist: 'cm',
  hips: 'cm',
  thigh: 'cm',
  arm: 'cm',
  custom: 'kg',
};

/** Units allowed per type — keep value-domain coherent (no `cm` for weight). */
const UNITS_FOR: Record<BodyMetricType, BodyMetricUnit[]> = {
  weight: ['kg', 'lbs'],
  body_fat: ['percent'],
  chest: ['cm', 'in'],
  waist: ['cm', 'in'],
  hips: ['cm', 'in'],
  thigh: ['cm', 'in'],
  arm: ['cm', 'in'],
  custom: ['kg', 'lbs', 'cm', 'in', 'percent'],
};

export default function LogMetricScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const isDark = colors.background === '#0A1628';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const bmT = (dict.bodyMetrics ?? {}) as Record<string, unknown>;
  const types = (bmT.types ?? {}) as Record<string, string>;
  const units = (bmT.units ?? {}) as Record<string, string>;
  const formT = (bmT.form ?? {}) as Record<string, string>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    title: (bmT.addMetric as string) ?? 'Add Metric',
    type: formT.type ?? 'Type',
    value: formT.value ?? 'Value',
    unit: formT.unit ?? 'Unit',
    notes: formT.notes ?? 'Notes',
    date: formT.date ?? 'Date',
    notesPlaceholder: (bmT.metricAdded as string) ?? 'Optional notes',
    cancel: commonT.cancel ?? 'Cancel',
    save: commonT.save ?? 'Save',
    saving: commonT.loading ?? 'Saving…',
    selectType: types.weight ? 'Select metric' : 'Select metric',
  };

  const [type, setType] = useState<BodyMetricType>('weight');
  const [unit, setUnit] = useState<BodyMetricUnit>(DEFAULT_UNIT_FOR.weight);
  const [valueText, setValueText] = useState('');
  const [recordedAt, setRecordedAt] = useState<string>(() => isoDate());
  const [notes, setNotes] = useState('');

  // Re-pick unit when type changes (e.g. weight→cm doesn't make sense).
  const onChangeType = (next: BodyMetricType) => {
    setType(next);
    setUnit(DEFAULT_UNIT_FOR[next]);
  };

  const mutation = useLogMetric(orgId);
  const numericValue = Number.parseFloat(valueText.replace(',', '.'));
  const canSubmit =
    Number.isFinite(numericValue) && numericValue > 0 && !!recordedAt;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    const payload: CreateBodyMetricInput = {
      metricType: type,
      value: numericValue,
      unit,
      recordedAt: new Date(recordedAt).toISOString(),
      notes: notes.trim() || undefined,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        haptics.success();
        router.back();
      },
      onError: () => haptics.error(),
    });
  };

  const typeOptions = useMemo(
    () =>
      TYPE_ORDER.map((v) => ({
        value: v,
        label: types[v] ?? v,
      })),
    [types],
  );
  const unitOptions = useMemo(
    () =>
      UNITS_FOR[type].map((u) => ({
        value: u,
        label: units[u] ?? u,
      })),
    [type, units],
  );

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FKModalHeader
          title={labels.title}
          leadingAction={{
            label: labels.cancel,
            onPress: () => router.back(),
          }}
          trailingAction={{
            label: mutation.isPending ? labels.saving : labels.save,
            style: 'primary',
            onPress: handleSubmit,
            disabled: !canSubmit || mutation.isPending,
          }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(40).duration(260)}>
            <Field label={labels.type} isRTL={isRTL} colors={colors}>
              <FKSelectSheet<BodyMetricType>
                value={type}
                placeholder={labels.selectType}
                title={labels.type}
                options={typeOptions}
                onChange={onChangeType}
                cancelLabel={labels.cancel}
              />
            </Field>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(70).duration(260)}>
            <FKGlassPanel
              radius={16}
              style={{ padding: 12, gap: 10 }}
            >
              <FieldLabel
                isRTL={isRTL}
                colors={colors}
                text={labels.value}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <TextInput
                  value={valueText}
                  onChangeText={setValueText}
                  placeholder="0.0"
                  placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={{
                    flex: 1,
                    height: 44,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(94,112,130,0.20)',
                    fontSize: 18,
                    fontWeight: '700',
                    fontFamily: 'DMMono',
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                />
                <View style={{ minWidth: 96, flexShrink: 0 }}>
                  <FKSelectSheet<BodyMetricUnit>
                    value={unit}
                    placeholder={labels.unit}
                    title={labels.unit}
                    options={unitOptions}
                    onChange={setUnit}
                    cancelLabel={labels.cancel}
                  />
                </View>
              </View>
            </FKGlassPanel>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(260)}>
            <Field label={labels.date} isRTL={isRTL} colors={colors}>
              <FKDateField
                value={recordedAt}
                onChange={setRecordedAt}
                maximumDate={new Date()}
              />
            </Field>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(130).duration(260)}>
            <Field label={labels.notes} isRTL={isRTL} colors={colors}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={labels.notesPlaceholder}
                placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
                multiline
                style={{
                  minHeight: 80,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(94,112,130,0.20)',
                  fontSize: 14,
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  textAlign: isRTL ? 'right' : 'left',
                  textAlignVertical: 'top',
                }}
              />
            </Field>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function FieldLabel({
  text,
  isRTL,
  colors,
}: {
  text: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: colors.mutedFg,
        textAlign: isRTL ? 'right' : 'left',
        fontFamily: 'DMMono',
      }}
    >
      {text}
    </Text>
  );
}

function Field({
  label,
  isRTL,
  colors,
  children,
}: {
  label: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel text={label} isRTL={isRTL} colors={colors} />
      {children}
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
