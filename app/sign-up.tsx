/**
 * /sign-up — invite-only acceptance screen.
 *
 * NOT a free-form sign-up. Members are created via the gym's Clerk
 * invitation flow; the email links to `clerk.fitkit.fit/v1/tickets/accept`
 * which validates the ticket server-side and redirects to
 * `https://app.fitkit.fit/sign-up?__clerk_ticket=...&__clerk_status=sign_up`
 * (or `sign_in` for existing users being added to a second org).
 *
 * That redirect URL is intercepted by Universal Links / App Links and
 * lands here.
 *
 * Flow:
 *   1. Read `__clerk_ticket` + `__clerk_status` from the route params.
 *   2. No ticket → friendly "you need an invite" screen with a button
 *      back to /sign-in. Web-side handles this fallback for the no-app
 *      case; this branch covers users who land here without a ticket
 *      (e.g. they typed the URL).
 *   3. status=sign_up:
 *      a. signUp.create({ strategy: 'ticket', ticket }) — Clerk pulls
 *         the email from the ticket. If the account is missing required
 *         fields (password), `attempt.status === 'missing_requirements'`.
 *      b. Show the "Set your password" card.
 *      c. signUp.update({ password }) → setActive → redirect.
 *   4. status=sign_in (existing user, multi-org invite):
 *      a. signIn.create({ strategy: 'ticket', ticket }) → setActive →
 *         redirect.
 *
 * Visual: same shell as /sign-in (FKBrandMark + glass card) so the
 * member experiences one coherent visual language across auth surfaces.
 */
import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import {
  FKAmbientBackdrop,
  FKBrandMark,
  FKButton,
  FKGlassPanel,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';
const MIN_PASSWORD = 8;

type Phase =
  | 'processing-ticket' // running signUp.create or signIn.create
  | 'set-password' // need user to set a password
  | 'no-ticket' // arrived without ?__clerk_ticket
  | 'error'; // ticket invalid / expired / consumed

export default function SignUpScreen() {
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const haptics = useHaptics();
  const params = useLocalSearchParams<{
    __clerk_ticket?: string;
    __clerk_status?: string;
    ticket?: string; // some Clerk versions strip the underscores
    status?: string;
  }>();
  const ticket = params.__clerk_ticket ?? params.ticket ?? '';
  const status = (params.__clerk_status ?? params.status ?? 'sign_up') as
    | 'sign_up'
    | 'sign_in';

  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } =
    useSignUp();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } =
    useSignIn();
  // Used to clear a stale session before a sign_up ticket — see effect.
  const { signOut, isLoaded: authLoaded, isSignedIn } = useAuth();

  const auth = (t as Record<string, unknown>).auth as
    | Record<string, string>
    | undefined;

  const labels = {
    welcome: auth?.inviteWelcome ?? 'Welcome to FitKit',
    setupSubtitle:
      auth?.inviteSetupSubtitle ?? 'Set a password to finish setting up your account.',
    processingSubtitle:
      auth?.inviteProcessingSubtitle ?? 'Just a moment — verifying your invite…',
    noTicketTitle: auth?.inviteNoTicketTitle ?? 'Invite needed',
    noTicketSubtitle:
      auth?.inviteNoTicketSubtitle ??
      "We couldn't find an invite link. Ask your gym to send you a new one, or sign in if you already have an account.",
    errorTitle: auth?.inviteErrorTitle ?? 'Invite link unavailable',
    errorSubtitle:
      auth?.inviteErrorSubtitle ??
      "This invite is no longer valid. It may have expired or already been used. Ask your gym for a new link.",
    password: auth?.password ?? 'Password',
    passwordPlaceholder:
      auth?.passwordSetupPlaceholder ?? `At least ${MIN_PASSWORD} characters`,
    showPassword: auth?.showPassword ?? 'Show password',
    hidePassword: auth?.hidePassword ?? 'Hide password',
    finish: auth?.finishSetup ?? 'Create account',
    finishing: auth?.finishingSetup ?? 'Creating account…',
    backToSignIn: auth?.backToSignIn ?? 'Sign in instead',
  };

  const [phase, setPhase] = useState<Phase>(
    ticket ? 'processing-ticket' : 'no-ticket',
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — exchange the ticket. Runs once when Clerk SDKs load.
  useEffect(() => {
    if (
      !ticket ||
      !signUpLoaded ||
      !signInLoaded ||
      !authLoaded ||
      phase !== 'processing-ticket'
    )
      return;
    let cancelled = false;

    const run = async () => {
      try {
        // A sign_up ticket creates a NEW account. If the device has a
        // stale Clerk session (the secure-token cache survived an
        // earlier sign-out, or a different member shared this phone
        // earlier), clear it before calling signUp.create — otherwise
        // Clerk would hand us the existing session and AuthGate would
        // fast-forward into the wrong user's tab shell. sign_in tickets
        // DO want to keep the existing session (the whole point is
        // adding a second-org membership to the current user), so we
        // only force-clear in the sign_up branch.
        if (status === 'sign_up' && isSignedIn) {
          await signOut();
        }

        if (status === 'sign_in') {
          // Existing user, second-org invite.
          const result = await signIn.create({
            strategy: 'ticket',
            ticket,
          });
          if (cancelled) return;
          if (result.status === 'complete') {
            await setActiveSignIn({ session: result.createdSessionId });
            haptics.success();
            router.replace('/(tabs)');
            return;
          }
          // Multi-factor or unexpected state — surface a generic error.
          setError(`Unexpected sign-in status: ${result.status}`);
          setPhase('error');
          return;
        }

        // status === 'sign_up' (default)
        const attempt = await signUp.create({
          strategy: 'ticket',
          ticket,
        });
        if (cancelled) return;
        if (attempt.status === 'complete') {
          // Clerk pre-set a password — straight in.
          await setActiveSignUp({ session: attempt.createdSessionId });
          haptics.success();
          router.replace('/(tabs)');
          return;
        }
        if (
          attempt.status === 'missing_requirements' &&
          attempt.missingFields.includes('password')
        ) {
          setPhase('set-password');
          return;
        }
        // Some other missing requirement (e.g. phone verification) — let
        // the member know we hit something we don't handle yet.
        setError(
          `Sign-up requires additional fields we don't yet handle: ${attempt.missingFields.join(
            ', ',
          )}`,
        );
        setPhase('error');
      } catch (err: unknown) {
        if (cancelled) return;
        const clerkError = (err as {
          errors?: { code?: string; message: string; longMessage?: string }[];
        }).errors?.[0];
        const detail =
          clerkError?.longMessage ??
          clerkError?.message ??
          'Could not validate your invite.';
        setError(detail);
        setPhase('error');
        haptics.error();
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    ticket,
    status,
    signUpLoaded,
    signInLoaded,
    authLoaded,
    isSignedIn,
    signOut,
    phase,
    signIn,
    signUp,
    setActiveSignIn,
    setActiveSignUp,
    haptics,
  ]);

  // Step 2 — submit the password to complete sign-up.
  const submitPassword = async () => {
    if (!signUpLoaded || submitting) return;
    if (password.length < MIN_PASSWORD) {
      setError(
        auth?.passwordTooShort ??
          `Password must be at least ${MIN_PASSWORD} characters.`,
      );
      haptics.error();
      return;
    }
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.update({ password });
      if (attempt.status === 'complete') {
        await setActiveSignUp({ session: attempt.createdSessionId });
        haptics.success();
        router.replace('/(tabs)');
        return;
      }
      setError(`Unexpected sign-up status: ${attempt.status}`);
      haptics.error();
    } catch (err: unknown) {
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      let detail =
        clerkError?.longMessage ??
        clerkError?.message ??
        'Could not set your password.';
      if (clerkError?.code === 'form_password_pwned') {
        detail =
          auth?.passwordPwned ??
          'That password was found in a data breach. Please pick a different one.';
      }
      setError(detail);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const renderHero = (titleKey: 'welcome' | 'noTicketTitle' | 'errorTitle', sub?: string) => (
    <View style={{ alignItems: 'center', gap: 14, paddingBottom: 4 }}>
      <View style={{ paddingBottom: 12 }}>
        <FKBrandMark size={40} />
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text
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
          {labels[titleKey]}
        </Text>
        {sub ? (
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
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
    <FKAmbientBackdrop />
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
            gap: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'processing-ticket' ? (
            <>
              {renderHero('welcome', labels.processingSubtitle)}
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={BRAND_TEAL} />
              </View>
            </>
          ) : null}

          {phase === 'set-password' ? (
            <>
              {renderHero('welcome', labels.setupSubtitle)}
              <FKGlassPanel radius={20} style={{ padding: 20, gap: 16 }}>
                <Field label={labels.password} isRTL={isRTL}>
                  <PasswordInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={labels.passwordPlaceholder}
                    visible={showPassword}
                    onToggleVisibility={() => {
                      haptics.select();
                      setShowPassword((v) => !v);
                    }}
                    isDark={isDark}
                    isRTL={isRTL}
                    fg={colors.foreground}
                    showLabel={labels.showPassword}
                    hideLabel={labels.hidePassword}
                    onSubmit={submitPassword}
                  />
                </Field>

                {error ? (
                  <ErrorBanner text={error} isDark={isDark} isRTL={isRTL} />
                ) : null}

                <FKButton
                  label={submitting ? labels.finishing : labels.finish}
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={submitting || password.length < MIN_PASSWORD}
                  onPress={submitPassword}
                />
              </FKGlassPanel>
            </>
          ) : null}

          {phase === 'no-ticket' ? (
            <>
              {renderHero('noTicketTitle', labels.noTicketSubtitle)}
              <Link href="/(auth)/sign-in" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={labels.backToSignIn}
                  style={{ alignSelf: 'center' }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: BRAND_TEAL,
                    }}
                  >
                    {labels.backToSignIn}
                  </Text>
                </Pressable>
              </Link>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              {renderHero('errorTitle', error ?? labels.errorSubtitle)}
              <Link href="/(auth)/sign-in" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={labels.backToSignIn}
                  style={{ alignSelf: 'center' }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: BRAND_TEAL,
                    }}
                  >
                    {labels.backToSignIn}
                  </Text>
                </Pressable>
              </Link>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

// ── Subcomponents (mirror /sign-in) ───────────────────────────────────

function Field({
  label,
  isRTL,
  children,
}: {
  label: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 11,
          fontWeight: '700',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisibility,
  isDark,
  isRTL,
  fg,
  showLabel,
  hideLabel,
  onSubmit,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  visible: boolean;
  onToggleVisibility: () => void;
  isDark: boolean;
  isRTL: boolean;
  fg: string;
  showLabel: string;
  hideLabel: string;
  onSubmit?: () => void;
}) {
  const ToggleIcon = visible ? EyeOff : Eye;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.25)',
        backgroundColor: isDark
          ? 'rgba(118,118,128,0.20)'
          : 'rgba(118,118,128,0.10)',
        paddingHorizontal: 14,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={
          isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
        }
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        secureTextEntry={!visible}
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '500',
          color: fg,
          textAlign: isRTL ? 'right' : 'left',
          paddingVertical: 0,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? hideLabel : showLabel}
        hitSlop={10}
        onPress={onToggleVisibility}
        style={{ paddingHorizontal: 4, paddingVertical: 4 }}
      >
        <ToggleIcon
          size={20}
          color={isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'}
          strokeWidth={2}
        />
      </Pressable>
    </View>
  );
}

function ErrorBanner({
  text,
  isDark,
  isRTL,
}: {
  text: string;
  isDark: boolean;
  isRTL: boolean;
}) {
  return (
    <View
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
        {text}
      </Text>
    </View>
  );
}
