/**
 * Sign-in screen — iOS-native form aesthetic.
 *
 * Layout per HIG (Apple ID sign-in, Mail account setup):
 *   - Hero block at the top: 56pt brand mark + brand wordmark + subtitle
 *   - Form in a single FKGlassPanel (matches the onboarding-screen idiom)
 *   - 11pt uppercase labels above each input (same as profile/personal.tsx)
 *   - Trailing eye-toggle on the password field
 *   - Inline "Forgot password?" link (right-aligned, switches to the
 *     native Clerk reset flow — no web page involved)
 *   - FKButton primary CTA at the bottom of the card
 *   - Footer link to sign-up
 *
 * The MFA and password-reset stages reuse the same shell with different
 * card bodies. Reset uses Clerk's reset_password_email_code strategy:
 * create() emails the code, attemptFirstFactor() takes code + new
 * password in one shot and signs the user in.
 */
import { useSignIn } from '@clerk/clerk-expo';
import type { SignInResource } from '@clerk/types';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
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
  FKBrandMark,
  FKButton,
  FKGlassPanel,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

type Stage = 'credentials' | 'second-factor' | 'reset-request' | 'reset-verify';

type SecondFactorStrategy =
  | 'totp'
  | 'phone_code'
  | 'backup_code'
  | 'email_code';

interface ChosenFactor {
  strategy: SecondFactorStrategy;
  phoneNumberId?: string;
  emailAddressId?: string;
  safeIdentifier?: string;
}

const BRAND_TEAL = '#0E8C8C';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const haptics = useHaptics();
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [factor, setFactor] = useState<ChosenFactor | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const auth = (t as Record<string, unknown>).auth as
    | Record<string, string>
    | undefined;

  const labels = {
    welcome: auth?.welcomeBack ?? 'Welcome back',
    subtitle: auth?.signInSubtitle ?? 'Sign in to continue your training',
    email: auth?.email ?? 'Email',
    emailPlaceholder: auth?.emailPlaceholder ?? 'you@example.com',
    password: auth?.password ?? 'Password',
    passwordPlaceholder: auth?.passwordPlaceholder ?? '••••••••',
    showPassword: auth?.showPassword ?? 'Show password',
    hidePassword: auth?.hidePassword ?? 'Hide password',
    forgot: auth?.forgotPassword ?? 'Forgot password?',
    submit: auth?.signIn ?? 'Sign in',
    submitting: auth?.signingIn ?? 'Signing in…',
    invitedFooter:
      auth?.invitedFooter ??
      'New here? Ask your gym to send you an invite link.',
    mfaTitle: auth?.mfaTitle ?? 'Verify your account',
    mfaSubtitle:
      auth?.mfaSubtitle ?? 'One more step to keep your account safe.',
    mfaCodeLabel: auth?.mfaCodeLabel ?? 'Verification code',
    mfaCodePlaceholder: '------',
    mfaSubmit: auth?.mfaSubmit ?? 'Verify',
    mfaSubmitting: auth?.mfaSubmitting ?? 'Verifying…',
    mfaBack: auth?.mfaBack ?? 'Use a different account',
    mfaTotpDesc:
      auth?.mfaTotpDesc ??
      'Enter the 6-digit code from your authenticator app.',
    mfaPhoneDesc:
      auth?.mfaPhoneDesc ?? 'Enter the code we just texted you.',
    mfaEmailDesc:
      auth?.mfaEmailDesc ?? 'Enter the code we just emailed you.',
    mfaBackupDesc:
      auth?.mfaBackupDesc ?? 'Enter one of your backup codes.',
    resetTitle: auth?.resetTitle ?? 'Reset your password',
    resetRequestDesc:
      auth?.resetRequestDesc ??
      "Enter your email and we'll send you a reset code.",
    resetVerifyDesc:
      auth?.resetVerifyDesc ??
      'Enter the code we emailed you and choose a new password.',
    resetSend: auth?.resetSend ?? 'Send reset code',
    resetSending: auth?.resetSending ?? 'Sending…',
    resetCodeLabel: auth?.resetCodeLabel ?? 'Reset code',
    newPassword: auth?.newPassword ?? 'New password',
    resetSubmit: auth?.resetSubmit ?? 'Reset password',
    resetSubmitting: auth?.resetSubmitting ?? 'Resetting…',
    resetBack: auth?.resetBack ?? 'Back to sign in',
  };

  const factorDescription = (() => {
    if (!factor) return labels.mfaSubtitle;
    if (factor.strategy === 'totp') return labels.mfaTotpDesc;
    if (factor.strategy === 'phone_code') {
      const tail = factor.safeIdentifier ? ` (${factor.safeIdentifier})` : '';
      return labels.mfaPhoneDesc + tail;
    }
    if (factor.strategy === 'email_code') {
      const tail = factor.safeIdentifier ? ` (${factor.safeIdentifier})` : '';
      return labels.mfaEmailDesc + tail;
    }
    return labels.mfaBackupDesc;
  })();

  const resetToCredentials = () => {
    setStage('credentials');
    setFactor(null);
    setCode('');
    setNewPassword('');
    setError(null);
  };

  const enterSecondFactor = async (attempt: SignInResource) => {
    const supported = attempt.supportedSecondFactors ?? [];
    const totp = supported.find((f) => f.strategy === 'totp');
    const phone = supported.find((f) => f.strategy === 'phone_code');
    const emailCode = supported.find((f) => f.strategy === 'email_code');
    const backup = supported.find((f) => f.strategy === 'backup_code');
    const chosen = totp ?? phone ?? emailCode ?? backup;

    if (!chosen) {
      setError(
        'Account requires multi-factor verification, but no supported strategy is enrolled. Contact support.',
      );
      haptics.error();
      return;
    }

    if (chosen.strategy === 'phone_code') {
      await signIn?.prepareSecondFactor({
        strategy: 'phone_code',
        phoneNumberId: chosen.phoneNumberId,
      });
    } else if (chosen.strategy === 'email_code') {
      await signIn?.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: chosen.emailAddressId,
      });
    }

    setFactor({
      strategy: chosen.strategy as SecondFactorStrategy,
      phoneNumberId:
        chosen.strategy === 'phone_code' ? chosen.phoneNumberId : undefined,
      emailAddressId:
        chosen.strategy === 'email_code' ? chosen.emailAddressId : undefined,
      safeIdentifier:
        'safeIdentifier' in chosen
          ? (chosen as { safeIdentifier?: string }).safeIdentifier
          : undefined,
    });
    setCode('');
    setStage('second-factor');
  };

  const handleSignIn = async () => {
    if (!isLoaded || submitting) return;
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        haptics.success();
        router.replace('/(tabs)');
        return;
      }

      if (attempt.status === 'needs_second_factor') {
        await enterSecondFactor(attempt);
        return;
      }

      setError(`Unexpected sign-in status: ${attempt.status}`);
      haptics.error();
    } catch (err: unknown) {
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      // Surface a friendlier message for the common case (wrong password).
      let detail = clerkError?.longMessage ?? clerkError?.message ?? 'Sign-in failed.';
      if (clerkError?.code === 'form_password_incorrect') {
        detail = auth?.wrongCredentials ?? 'Incorrect email or password.';
      } else if (clerkError?.code === 'form_identifier_not_found') {
        detail = auth?.accountNotFound ?? "We couldn't find that account.";
      }
      setError(detail);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isLoaded || submitting || !factor) return;
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: factor.strategy,
        code: code.trim(),
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        haptics.success();
        router.replace('/(tabs)');
        return;
      }

      setError(`Unexpected verification status: ${result.status}`);
      haptics.error();
    } catch (err: unknown) {
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      const detail = clerkError
        ? `${clerkError.code ?? 'unknown'}: ${clerkError.longMessage ?? clerkError.message}`
        : 'Verification failed.';
      setError(detail);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    haptics.tap();
    setError(null);
    setStage('reset-request');
  };

  const handleRequestReset = async () => {
    if (!isLoaded || submitting || !email.trim()) return;
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setCode('');
      setNewPassword('');
      setStage('reset-verify');
    } catch (err: unknown) {
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      let detail =
        clerkError?.longMessage ?? clerkError?.message ?? 'Could not send reset code.';
      if (clerkError?.code === 'form_identifier_not_found') {
        detail = auth?.accountNotFound ?? "We couldn't find that account.";
      }
      setError(detail);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isLoaded || submitting) return;
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        haptics.success();
        router.replace('/(tabs)');
        return;
      }

      if (result.status === 'needs_second_factor') {
        await enterSecondFactor(result);
        return;
      }

      setError(`Unexpected reset status: ${result.status}`);
      haptics.error();
    } catch (err: unknown) {
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      let detail = clerkError
        ? `${clerkError.longMessage ?? clerkError.message}`
        : 'Password reset failed.';
      if (clerkError?.code === 'form_password_pwned') {
        detail =
          auth?.passwordPwned ??
          'This password has appeared in a data breach. Please choose a different one.';
      }
      setError(detail);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background }}
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
          {/* Hero — iOS auth-screen proportions (small brand mark, 26pt
              title, system fonts). No font-display: ClashGrotesk isn't
              loaded in this build (see app/_layout.tsx font require).
              writingDirection: ltr keeps Latin glyphs from getting
              BiDi-mirrored when the device locale is RTL.
              Extra paddingBottom on the brand-mark wrapper absorbs the
              FKBrandMark's 12pt cyan glow so it doesn't bleed onto the
              form card below it. */}
          <View style={{ alignItems: 'center', gap: 14, paddingBottom: 4 }}>
            <View style={{ paddingBottom: 12 }}>
              <FKBrandMark size={40} />
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  // iOS auth-screen title scale — Apple ID, Mail and
                  // Apple Music sign-in all sit in the 20–22pt range
                  // with semibold weight, not the big marketing display
                  // we had before. SF Pro Text @ 22pt / 600 / -0.2 px
                  // letter-spacing matches `headline` semantic style.
                  // Explicit lineHeight + paddingTop keep Hebrew letter
                  // tops (ת ה נ) from clipping at semibold.
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
                {stage === 'credentials'
                  ? labels.welcome
                  : stage === 'second-factor'
                    ? labels.mfaTitle
                    : labels.resetTitle}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '400',
                  lineHeight: 18,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  maxWidth: 300,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
                numberOfLines={2}
              >
                {stage === 'credentials'
                  ? labels.subtitle
                  : stage === 'second-factor'
                    ? factorDescription
                    : stage === 'reset-request'
                      ? labels.resetRequestDesc
                      : labels.resetVerifyDesc}
              </Text>
            </View>
          </View>

          {stage === 'credentials' ? (
            <FKGlassPanel radius={20} style={{ padding: 20, gap: 16 }}>
              <Field label={labels.email} isRTL={isRTL}>
                <BigTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={labels.emailPlaceholder}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  isDark={isDark}
                  isRTL={isRTL}
                  fg={colors.foreground}
                />
              </Field>

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
                  onSubmit={handleSignIn}
                />
              </Field>

              {/* Forgot password (trailing-aligned text link) */}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'flex-end',
                }}
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={labels.forgot}
                  hitSlop={8}
                  onPress={openForgotPassword}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: BRAND_TEAL,
                    }}
                  >
                    {labels.forgot}
                  </Text>
                </Pressable>
              </View>

              {error ? <ErrorBanner text={error} isDark={isDark} isRTL={isRTL} /> : null}

              <FKButton
                label={submitting ? labels.submitting : labels.submit}
                variant="primary"
                size="lg"
                fullWidth
                disabled={submitting || !email || !password}
                onPress={handleSignIn}
              />
            </FKGlassPanel>
          ) : stage === 'second-factor' ? (
            <FKGlassPanel radius={20} style={{ padding: 20, gap: 16 }}>
              <Field label={labels.mfaCodeLabel} isRTL={isRTL}>
                <BigTextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder={labels.mfaCodePlaceholder}
                  autoCapitalize="none"
                  autoComplete={
                    factor?.strategy === 'phone_code'
                      ? 'sms-otp'
                      : 'one-time-code'
                  }
                  keyboardType={
                    factor?.strategy === 'backup_code' ? 'default' : 'number-pad'
                  }
                  textContentType="oneTimeCode"
                  isDark={isDark}
                  isRTL={isRTL}
                  fg={colors.foreground}
                  monoFont
                  centered
                />
              </Field>

              {error ? <ErrorBanner text={error} isDark={isDark} isRTL={isRTL} /> : null}

              <FKButton
                label={submitting ? labels.mfaSubmitting : labels.mfaSubmit}
                variant="primary"
                size="lg"
                fullWidth
                disabled={submitting || !code}
                onPress={handleVerifyCode}
              />

              <FKButton
                label={labels.mfaBack}
                variant="ghost"
                size="md"
                fullWidth
                onPress={resetToCredentials}
              />
            </FKGlassPanel>
          ) : stage === 'reset-request' ? (
            <FKGlassPanel radius={20} style={{ padding: 20, gap: 16 }}>
              <Field label={labels.email} isRTL={isRTL}>
                <BigTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={labels.emailPlaceholder}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  onSubmitEditing={handleRequestReset}
                  isDark={isDark}
                  isRTL={isRTL}
                  fg={colors.foreground}
                />
              </Field>

              {error ? <ErrorBanner text={error} isDark={isDark} isRTL={isRTL} /> : null}

              <FKButton
                label={submitting ? labels.resetSending : labels.resetSend}
                variant="primary"
                size="lg"
                fullWidth
                disabled={submitting || !email.trim()}
                onPress={handleRequestReset}
              />

              <FKButton
                label={labels.resetBack}
                variant="ghost"
                size="md"
                fullWidth
                onPress={resetToCredentials}
              />
            </FKGlassPanel>
          ) : (
            <FKGlassPanel radius={20} style={{ padding: 20, gap: 16 }}>
              <Field label={labels.resetCodeLabel} isRTL={isRTL}>
                <BigTextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="------"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  isDark={isDark}
                  isRTL={isRTL}
                  fg={colors.foreground}
                  monoFont
                  centered
                />
              </Field>

              <Field label={labels.newPassword} isRTL={isRTL}>
                <PasswordInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={labels.passwordPlaceholder}
                  visible={showNewPassword}
                  onToggleVisibility={() => {
                    haptics.select();
                    setShowNewPassword((v) => !v);
                  }}
                  isDark={isDark}
                  isRTL={isRTL}
                  fg={colors.foreground}
                  showLabel={labels.showPassword}
                  hideLabel={labels.hidePassword}
                  onSubmit={handleResetPassword}
                  isNewPassword
                />
              </Field>

              {error ? <ErrorBanner text={error} isDark={isDark} isRTL={isRTL} /> : null}

              <FKButton
                label={submitting ? labels.resetSubmitting : labels.resetSubmit}
                variant="primary"
                size="lg"
                fullWidth
                disabled={submitting || !code.trim() || !newPassword}
                onPress={handleResetPassword}
              />

              <FKButton
                label={labels.resetBack}
                variant="ghost"
                size="md"
                fullWidth
                onPress={resetToCredentials}
              />
            </FKGlassPanel>
          )}

          {stage === 'credentials' ? (
            // Members can't self-register — accounts are created via the gym's
            // invite flow (Clerk invite link from WhatsApp/SMS/email). Surface
            // that explicitly so first-time visitors don't go hunting for a
            // missing Sign Up button.
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
                maxWidth: 320,
                alignSelf: 'center',
              }}
              numberOfLines={2}
            >
              {labels.invitedFooter}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

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
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function BigTextInput({
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  keyboardType,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  isDark,
  isRTL,
  fg,
  monoFont,
  centered,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  autoCorrect?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: () => void;
  isDark: boolean;
  isRTL: boolean;
  fg: string;
  monoFont?: boolean;
  centered?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={
        isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
      }
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      keyboardType={keyboardType}
      textContentType={textContentType}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      style={{
        height: 48,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.25)',
        backgroundColor: isDark
          ? 'rgba(118,118,128,0.20)'
          : 'rgba(118,118,128,0.10)',
        fontSize: monoFont ? 22 : 16,
        fontWeight: monoFont ? '700' : '500',
        fontFamily: monoFont ? 'Assistant-Medium' : undefined,
        color: fg,
        textAlign: centered ? 'center' : isRTL ? 'right' : 'left',
        letterSpacing: monoFont ? 4 : 0,
      }}
    />
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
  isNewPassword,
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
  isNewPassword?: boolean;
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
        autoComplete={isNewPassword ? 'new-password' : 'password'}
        autoCorrect={false}
        secureTextEntry={!visible}
        textContentType={isNewPassword ? 'newPassword' : 'password'}
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
