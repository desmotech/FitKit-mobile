/**
 * /onboarding/accept-terms — blocking legal-consent gate.
 *
 * Routed to by AuthGate when /users/me reports pendingLegalConsents=true.
 * No Cancel: the only way out is to accept (or sign out). After a
 * successful POST /legal/consents, the form invalidates /users/me, and
 * the next AuthGate render sees needsLegalConsent=false and routes the
 * user either to /onboarding/complete-profile (if profileComplete=false)
 * or to the tabs.
 *
 * Visual: large title + subtitle inside a SafeAreaView, the consent
 * form below in a single FKGlassPanel (matches the profile/personal.tsx
 * card aesthetic).
 */
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  FKAmbientBackdrop,
  FKBrandMark,
  FKGlassPanel,
  useFKColors,
} from '@/components/fk';
import { LegalConsentForm } from '@/components/legal/legal-consent-form';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useI18n } from '@/providers/i18n-provider';

export default function AcceptTermsScreen() {
  const router = useRouter();
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();
  const { activeOrganization, primaryRole, isProfileIncomplete } =
    useCurrentUser();

  const legalT = (t as unknown as Record<string, Record<string, unknown>>)
    .legal as Record<string, unknown> | undefined;
  const pageTitle =
    (legalT?.pageTitle as string) ?? 'Review & Accept Terms';
  const pageSubtitle =
    (legalT?.pageSubtitle as string) ??
    'Please review and accept the following before continuing.';

  const handleAccepted = () => {
    // Single source of truth for the onboarding chain is AuthGate.
    // We route to /(tabs); AuthGate inspects the FRESH /users/me +
    // /legal/consents/status (LegalConsentForm awaited the
    // invalidations) and chains to /onboarding/complete-profile if
    // the profile is still incomplete, or renders the tab shell
    // otherwise. Trying to branch here on local `isProfileIncomplete`
    // raced the cache and could ping-pong.
    void isProfileIncomplete;
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1 }}>
    <FKAmbientBackdrop />
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingHorizontal: 24,
            paddingBottom: 24,
            gap: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero — same pattern as /sign-in: brand mark + centered
              22pt semibold title + centered 13pt subtitle. Centered so
              the title doesn't read as "hugging the screen edge" the
              way a right-aligned heavy heading did before. */}
          <View
            style={{ alignItems: 'center', gap: 14, paddingBottom: 4 }}
          >
            <FKBrandMark size={56} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                numberOfLines={2}
                // Explicit lineHeight + paddingTop give Hebrew characters
                // enough vertical room. RN's default lineHeight (~fontSize
                // × 1.2) clips the tops of letters like ת ה נ at semibold,
                // which read as the title being "cut" against the line box.
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  lineHeight: 30,
                  letterSpacing: -0.2,
                  color: colors.foreground,
                  textAlign: 'center',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                  paddingTop: 4,
                }}
              >
                {pageTitle}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '400',
                  lineHeight: 18,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  maxWidth: 320,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
                numberOfLines={3}
              >
                {pageSubtitle}
              </Text>
            </View>
          </View>

          <FKGlassPanel radius={20} style={{ padding: 20 }}>
            <LegalConsentForm
              context={
                primaryRole === 'member' ? 'member_onboarding' : 'owner_onboarding'
              }
              organizationId={activeOrganization?.id}
              onAccepted={handleAccepted}
              standalone
            />
          </FKGlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}
