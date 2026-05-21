import { useSignIn } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

type Stage = 'credentials' | 'second-factor';

// Clerk v5 second-factor strategies. Some Clerk instances ship
// `email_code` as a *second* factor for new-device verification on top
// of password — that's what we hit on the FitKit dev instance.
type SecondFactorStrategy =
  | 'totp'
  | 'phone_code'
  | 'backup_code'
  | 'email_code';

interface ChosenFactor {
  strategy: SecondFactorStrategy;
  // Only set for phone_code — Clerk needs phoneNumberId to send the SMS.
  phoneNumberId?: string;
  // Set for email_code — Clerk needs emailAddressId to send the code.
  emailAddressId?: string;
  // Cached for the inline hint ("Enter code we sent to •••12").
  safeIdentifier?: string;
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { dir, t } = useI18n();
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState<ChosenFactor | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const auth = (t as Record<string, unknown>).auth as
    | Record<string, string>
    | undefined;

  const labels = {
    title: auth?.signInTitle ?? 'Sign in',
    email: auth?.email ?? 'Email',
    password: auth?.password ?? 'Password',
    submit: auth?.signIn ?? 'Sign in',
    noAccount: auth?.noAccount ?? "Don't have an account?",
    signUp: auth?.signUp ?? 'Sign up',
    mfaTitle: auth?.mfaTitle ?? 'Verify your account',
    mfaCodeLabel: auth?.mfaCodeLabel ?? 'Code',
    mfaSubmit: auth?.mfaSubmit ?? 'Verify',
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
  };

  const factorDescription = (() => {
    if (!factor) return '';
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
    setError(null);
  };

  const handleSignIn = async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      // Verbose dev logging — Clerk's status + factor lists tell us what
      // the instance actually expects (TOTP vs phone vs email-on-new-device
      // vs missing strategy etc.). Strip before production.
      console.log('[clerk:signIn.create]', {
        status: attempt.status,
        firstFactorVerification: attempt.firstFactorVerification,
        secondFactorVerification: attempt.secondFactorVerification,
        supportedFirstFactors: attempt.supportedFirstFactors,
        supportedSecondFactors: attempt.supportedSecondFactors,
        identifier: attempt.identifier,
        userData: attempt.userData,
      });

      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
        return;
      }

      if (attempt.status === 'needs_second_factor') {
        const supported = attempt.supportedSecondFactors ?? [];
        // Preference: TOTP (no roundtrip) > phone_code > email_code > backup_code.
        const totp = supported.find((f) => f.strategy === 'totp');
        const phone = supported.find((f) => f.strategy === 'phone_code');
        const emailCode = supported.find((f) => f.strategy === 'email_code');
        const backup = supported.find((f) => f.strategy === 'backup_code');
        const chosen = totp ?? phone ?? emailCode ?? backup;

        if (!chosen) {
          setError(
            'Account requires multi-factor verification, but no supported strategy is enrolled. Contact support.',
          );
          return;
        }

        if (chosen.strategy === 'phone_code') {
          await signIn.prepareSecondFactor({
            strategy: 'phone_code',
            phoneNumberId: chosen.phoneNumberId,
          });
        } else if (chosen.strategy === 'email_code') {
          await signIn.prepareSecondFactor({
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
        setStage('second-factor');
        return;
      }

      // needs_first_factor / needs_new_password / etc. — surface verbatim
      // so dev knows what config the Clerk instance is asking for.
      setError(`Unexpected sign-in status: ${attempt.status}`);
    } catch (err: unknown) {
      // Dump the entire Clerk error payload — code, longMessage, paramName,
      // meta — so we know whether it's form_password_incorrect,
      // form_identifier_not_found, strategy_for_user_invalid, etc.
      console.log('[clerk:signIn.create:error]', {
        raw: err,
        message: (err as Error)?.message,
        errors: (err as { errors?: unknown[] }).errors,
        clerkTraceId: (err as { clerkTraceId?: string }).clerkTraceId,
      });
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      const detail = clerkError
        ? `${clerkError.code ?? 'unknown'}: ${clerkError.longMessage ?? clerkError.message}`
        : 'Sign-in failed.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isLoaded || submitting || !factor) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: factor.strategy,
        code: code.trim(),
      });

      console.log('[clerk:attemptSecondFactor]', {
        strategy: factor.strategy,
        status: result.status,
        secondFactorVerification: result.secondFactorVerification,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
        return;
      }

      setError(`Unexpected verification status: ${result.status}`);
    } catch (err: unknown) {
      console.log('[clerk:attemptSecondFactor:error]', {
        raw: err,
        message: (err as Error)?.message,
        errors: (err as { errors?: unknown[] }).errors,
      });
      const clerkError = (err as {
        errors?: { code?: string; message: string; longMessage?: string }[];
      }).errors?.[0];
      const detail = clerkError
        ? `${clerkError.code ?? 'unknown'}: ${clerkError.longMessage ?? clerkError.message}`
        : 'Verification failed.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" style={{ direction: dir }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center">
            <View className="mb-8">
              <Text className="text-3xl font-display font-extrabold tracking-tight text-foreground">
                FitKit
              </Text>
              <Text className="text-base text-muted-foreground mt-1">
                {stage === 'credentials' ? labels.title : labels.mfaTitle}
              </Text>
            </View>

            {stage === 'credentials' ? (
              <Card className="p-5 gap-4">
                <View className="gap-1.5">
                  <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {labels.email}
                  </Text>
                  <Input
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View className="gap-1.5">
                  <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {labels.password}
                  </Text>
                  <Input
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {error ? (
                  <Text className="text-destructive text-sm">{error}</Text>
                ) : null}

                <Button
                  label={submitting ? '…' : labels.submit}
                  onPress={handleSignIn}
                  disabled={submitting || !email || !password}
                  fullWidth
                  size="lg"
                />
              </Card>
            ) : (
              <Card className="p-5 gap-4">
                <Text className="text-sm text-muted-foreground">
                  {factorDescription}
                </Text>

                <View className="gap-1.5">
                  <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {labels.mfaCodeLabel}
                  </Text>
                  <Input
                    autoCapitalize="none"
                    autoComplete={
                      factor?.strategy === 'phone_code'
                        ? 'sms-otp'
                        : factor?.strategy === 'email_code'
                          ? 'email'
                          : 'one-time-code'
                    }
                    keyboardType={
                      factor?.strategy === 'backup_code' ? 'default' : 'number-pad'
                    }
                    textContentType="oneTimeCode"
                    value={code}
                    onChangeText={setCode}
                  />
                </View>

                {error ? (
                  <Text className="text-destructive text-sm">{error}</Text>
                ) : null}

                <Button
                  label={submitting ? '…' : labels.mfaSubmit}
                  onPress={handleVerifyCode}
                  disabled={submitting || !code}
                  fullWidth
                  size="lg"
                />

                <Button
                  label={labels.mfaBack}
                  onPress={resetToCredentials}
                  variant="ghost"
                  fullWidth
                />
              </Card>
            )}

            {stage === 'credentials' ? (
              <View className="flex-row justify-center mt-6 gap-1.5">
                <Text className="text-sm text-muted-foreground">
                  {labels.noAccount}
                </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <Text className="text-sm text-primary font-semibold">
                    {labels.signUp}
                  </Text>
                </Link>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
