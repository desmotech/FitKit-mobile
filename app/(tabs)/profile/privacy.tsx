/**
 * Privacy & data settings — analytics opt-in/out.
 *
 * Mirrors the web app's "cookie preferences" control. The analytics choice is
 * first collected at the accept-terms gate (decline-by-default) and can be
 * withdrawn here at any time, satisfying GDPR Art. 7(3) ("withdrawal must be
 * as easy as consent"). The switch is the single source of truth: it persists
 * the choice and opts the live PostHog client in/out immediately.
 */
import { router } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { Switch, View } from 'react-native';
import { FKGlassPanel, FKSubScreen, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { openLegalDoc } from '@/components/legal/legal-doc-viewer';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '@/lib/analytics';

const BRAND_TEAL = '#0E8C8C';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function PrivacySettingsScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    getAnalyticsConsent,
  );

  const labels = {
    title: get(t, 'privacy.title') ?? 'Privacy & data',
    analyticsLabel: get(t, 'privacy.analyticsLabel') ?? 'Usage analytics',
    analyticsBody:
      get(t, 'privacy.analyticsBody') ??
      'Help improve FitKit by sharing anonymous data about how you use the app. We never sell your data, and you can turn this off at any time.',
    privacyPolicy:
      get(t, 'privacy.privacyPolicyLink') ?? 'Read our Privacy Policy',
  };

  const onToggle = (next: boolean) => {
    haptics.select();
    setAnalyticsConsent(next);
  };

  return (
    <FKSubScreen
      title={labels.title}
      onBack={() => router.back()}
      contentStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 16 }}
    >
      <FKGlassPanel radius={20} style={{ padding: 16, gap: 12 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: `${BRAND_TEAL}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} color={BRAND_TEAL} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: '700',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.analyticsLabel}
          </Text>
          <Switch
            value={consent}
            onValueChange={onToggle}
            trackColor={{
              false: isDark ? '#374151' : '#D1D5DB',
              true: BRAND_TEAL,
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={isDark ? '#374151' : '#D1D5DB'}
          />
        </View>

        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.analyticsBody}
        </Text>

        <Text
          onPress={() => {
            haptics.tap();
            openLegalDoc('privacy_policy');
          }}
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: BRAND_TEAL,
            textDecorationLine: 'underline',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.privacyPolicy}
        </Text>
      </FKGlassPanel>
    </FKSubScreen>
  );
}
