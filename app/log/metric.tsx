/**
 * Body-metric quick log.
 *
 * Visual: iOS grouped-list aesthetic. The type/unit select use the
 * `FKSelectSheet` action-sheet primitive (iOS native menu/action-sheet).
 *
 * Optional `?type=weight` query param pre-selects the metric type — used
 * by the metrics summary card tap-throughs.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import type {
  BodyMetricType,
  BodyMetricUnit,
  CreateBodyMetricInput,
} from '@fitkit/shared';
import {
  FKAmbientBackdrop,
  FKScreenHeader,
  FKSelectSheet,
  useFKColors,
} from '@/components/fk';
import { DatePresetField, HeaderSaveButton } from '@/components/log';
import { Text } from '@/components/ui/text';
import { useLogMetric } from '@/hooks/use-body-metrics';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { continuousCorners } from '@/lib/utils';
import { useLogStrings } from '@/i18n/use-log-strings';
import { ymd, ymdToInstantISO } from '@/lib/week';
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

function isBodyMetricType(v: string | undefined): v is BodyMetricType {
  return v != null && (TYPE_ORDER as readonly string[]).includes(v);
}

export default function LogMetricScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir, t } = useI18n();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const bmT = (dict.bodyMetrics ?? {}) as Record<string, unknown>;
  const L = useLogStrings();

  const initialType: BodyMetricType = isBodyMetricType(params.type)
    ? params.type
    : 'weight';
  const [type, setType] = useState<BodyMetricType>(initialType);
  const [unit, setUnit] = useState<BodyMetricUnit>(DEFAULT_UNIT_FOR[initialType]);
  const [valueText, setValueText] = useState('');
  const [recordedAt, setRecordedAt] = useState<string>(() => ymd(new Date()));
  const [notes, setNotes] = useState('');

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
      recordedAt: ymdToInstantISO(recordedAt),
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

  const typeOptions = useMemo(() => {
    const typesT = (bmT.types ?? {}) as Record<string, string>;
    return TYPE_ORDER.map((v) => ({
      value: v,
      label: typesT[v] ?? v,
    }));
  }, [bmT.types]);
  const unitOptions = useMemo(() => {
    const unitsT = (bmT.units ?? {}) as Record<string, string>;
    return UNITS_FOR[type].map((u) => ({
      value: u,
      label: unitsT[u] ?? u,
    }));
  }, [type, bmT.units]);

  const placeholderColor = isDark
    ? 'rgba(235,235,245,0.3)'
    : 'rgba(60,60,67,0.3)';

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <FKScreenHeader
            title={L.metricTitle}
            backLabel={null}
            onBack={() => router.back()}
            trailing={
              <HeaderSaveButton
                label={mutation.isPending ? L.workoutSaving : L.workoutSave}
                onPress={handleSubmit}
                disabled={!canSubmit || mutation.isPending}
              />
            }
          />

          <ScrollView
            contentContainerStyle={{
              padding: 20,
              paddingBottom: insets.bottom + 24,
              gap: 18,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type */}
            <View style={{ gap: 8 }}>
              <SectionLabel isRTL={isRTL}>{L.metricType}</SectionLabel>
              <FKSelectSheet<BodyMetricType>
                value={type}
                placeholder={L.metricSelectType}
                title={L.metricType}
                options={typeOptions}
                onChange={onChangeType}
                cancelLabel={L.hubCancel}
              />
            </View>

            {/* Value + unit */}
            <View style={{ gap: 8 }}>
              <SectionLabel isRTL={isRTL}>{L.metricValue}</SectionLabel>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={[
                    continuousCorners,
                    {
                      flex: 1,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      borderWidth: 1.5,
                    },
                  ]}
                  className="bg-card border-border"
                >
                  <TextInput
                    accessibilityLabel={L.metricValue}
                    value={valueText}
                    onChangeText={setValueText}
                    placeholder="0.0"
                    placeholderTextColor={placeholderColor}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    style={{
                      paddingVertical: 12,
                      fontSize: 26,
                      fontWeight: '700',
                      fontFamily: 'Assistant-Medium',
                      color: colors.foreground,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  />
                </View>
                <View style={{ minWidth: 96, flexShrink: 0 }}>
                  <FKSelectSheet<BodyMetricUnit>
                    value={unit}
                    placeholder={L.metricUnit}
                    title={L.metricUnit}
                    options={unitOptions}
                    onChange={setUnit}
                    cancelLabel={L.hubCancel}
                  />
                </View>
              </View>
            </View>

            {/* When */}
            <View style={{ gap: 8 }}>
              <SectionLabel isRTL={isRTL}>{L.metricDate}</SectionLabel>
              <DatePresetField value={recordedAt} onChange={setRecordedAt} />
            </View>

            {/* Notes */}
            <View style={{ gap: 8 }}>
              <SectionLabel isRTL={isRTL}>{L.metricNotes}</SectionLabel>
              <View
                style={[
                  continuousCorners,
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 4,
                    borderRadius: 14,
                    borderWidth: 1.5,
                  },
                ]}
                className="bg-card border-border"
              >
                <TextInput
                  accessibilityLabel={L.metricNotes}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={L.metricNotesPlaceholder}
                  placeholderTextColor={placeholderColor}
                  multiline
                  style={{
                    minHeight: 72,
                    paddingVertical: 8,
                    fontSize: 15,
                    color: colors.foreground,
                    textAlign: isRTL ? 'right' : 'left',
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>

            {mutation.error && (
              <Animated.View
                entering={FadeIn.duration(160)}
                style={{
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  padding: 12,
                  backgroundColor: isDark
                    ? 'rgba(255,69,58,0.16)'
                    : 'rgba(255,59,48,0.12)',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: isDark ? '#FF453A' : '#D70015',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {L.metricFailed}
                </Text>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

function SectionLabel({
  children,
  isRTL,
}: {
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <Text
      className="text-muted-foreground"
      style={{
        fontSize: 11,
        fontWeight: '700',
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {children}
    </Text>
  );
}

