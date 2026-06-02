/**
 * Feedback pageSheet — mobile entry point for the existing web feedback
 * pipeline. POSTs directly to the web's `/api/send` (Next.js route at
 * apps/web/src/app/api/send/route.ts), which handles identity resolution,
 * 5-min-per-user rate limiting, and the Resend email → Linear inbox.
 *
 * No NestJS endpoint involved on purpose — web doesn't have one either,
 * and the existing route accepts the same Clerk Bearer token the mobile
 * app already uses for the API.
 */
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { Bug, Sparkles } from 'lucide-react-native';
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
import { webUrl } from '@/lib/api';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

type FeedbackType = 'bug' | 'feature_request';
const MAX_LENGTH = 2000;
const BRAND_TEAL = '#0E8C8C';
const DESTRUCTIVE = '#EF4444';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function FeedbackScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { getToken } = useAuth();

  const [type, setType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels = useMemo(
    () => ({
      title: get(t, 'feedback.title') ?? 'Report an Issue',
      description:
        get(t, 'feedback.description') ??
        'Help us improve FitKit by reporting bugs or suggesting features.',
      bug: get(t, 'feedback.bug') ?? 'Bug Report',
      feature: get(t, 'feedback.feature') ?? 'Feature Request',
      content: get(t, 'feedback.content') ?? 'Description',
      placeholder:
        get(t, 'feedback.contentPlaceholder') ??
        'Please describe the issue or your suggestion…',
      submit: get(t, 'feedback.submit') ?? 'Send Report',
      success: get(t, 'feedback.success') ?? 'Report sent.',
      error:
        get(t, 'feedback.error') ?? 'Failed to send report. Please try again.',
      rateLimited:
        get(t, 'feedback.rateLimited') ??
        "You've already submitted recently. Please wait a few minutes.",
      cancel: get(t, 'common.cancel') ?? 'Cancel',
    }),
    [t],
  );

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !submitting;
  const isBug = type === 'bug';
  const remaining = MAX_LENGTH - content.length;
  const accent = isBug ? DESTRUCTIVE : BRAND_TEAL;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    haptics.tap();
    try {
      const token = await getToken();
      const res = await fetch(`${webUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, content: trimmed }),
      });

      if (res.status === 429) {
        haptics.error();
        Alert.alert('', labels.rateLimited);
        return;
      }
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      haptics.success();
      Alert.alert('', labels.success);
      router.back();
    } catch {
      haptics.error();
      Alert.alert('', labels.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={labels.title}
        leadingAction={{ label: labels.cancel, onPress: () => router.back() }}
        trailingAction={{
          label: labels.submit,
          onPress: handleSubmit,
          style: 'primary',
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
            {labels.description}
          </Text>

          {/* Type toggle — visual cards beat a picker for binary choice */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 10,
            }}
          >
            <TypeCard
              icon={Bug}
              label={labels.bug}
              accent={DESTRUCTIVE}
              selected={isBug}
              isDark={isDark}
              colors={colors}
              onPress={() => {
                haptics.select();
                setType('bug');
              }}
            />
            <TypeCard
              icon={Sparkles}
              label={labels.feature}
              accent={BRAND_TEAL}
              selected={!isBug}
              isDark={isDark}
              colors={colors}
              onPress={() => {
                haptics.select();
                setType('feature_request');
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
                fontFamily: 'DMMono',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {labels.content}
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={labels.placeholder}
                placeholderTextColor={colors.mutedFg}
                multiline
                maxLength={MAX_LENGTH}
                style={{
                  minHeight: 160,
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 28,
                  paddingRight: isRTL ? 14 : 14,
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
                  fontFamily: 'DMMono',
                  fontVariant: ['tabular-nums'],
                  color:
                    remaining < 100
                      ? DESTRUCTIVE
                      : remaining < 400
                        ? '#D97706'
                        : colors.mutedFg,
                }}
              >
                {content.length}/{MAX_LENGTH}
              </Text>
            </View>
          </View>

          {/* Type-aware accent strip mirrors the web dialog */}
          <View
            style={{
              height: 3,
              borderRadius: 999,
              backgroundColor: accent,
              opacity: 0.65,
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function TypeCard({
  icon: Icon,
  label,
  accent,
  selected,
  isDark,
  colors,
  onPress,
}: {
  icon: typeof Bug;
  label: string;
  accent: string;
  selected: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
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
            size={16}
            color={selected ? accent : colors.mutedFg}
            strokeWidth={2.2}
          />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: '600',
              color: selected ? accent : colors.mutedFg,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
