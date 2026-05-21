import { useSignUp } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

type Stage = 'collect' | 'verify';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { dir, t } = useI18n();
  const [stage, setStage] = useState<Stage>('collect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const auth = (t as Record<string, unknown>).auth as
    | Record<string, string>
    | undefined;

  const labels = {
    title: auth?.signUpTitle ?? 'Create account',
    email: auth?.email ?? 'Email',
    password: auth?.password ?? 'Password',
    code: auth?.verificationCode ?? 'Verification code',
    submit: auth?.signUp ?? 'Create account',
    verify: auth?.verify ?? 'Verify email',
    haveAccount: auth?.haveAccount ?? 'Already have an account?',
    signIn: auth?.signIn ?? 'Sign in',
  };

  const startSignUp = async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err: unknown) {
      setError(
        (err as { errors?: { message: string }[] }).errors?.[0]?.message ??
          'Sign-up failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError(`Unexpected status: ${attempt.status}`);
      }
    } catch (err: unknown) {
      setError(
        (err as { errors?: { message: string }[] }).errors?.[0]?.message ??
          'Verification failed.',
      );
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
                {labels.title}
              </Text>
            </View>

            <Card className="p-5 gap-4">
              {stage === 'collect' ? (
                <>
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
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>
                  {error ? (
                    <Text className="text-destructive text-sm">{error}</Text>
                  ) : null}
                  <Button
                    label={submitting ? '…' : labels.submit}
                    onPress={startSignUp}
                    disabled={submitting || !email || !password}
                    fullWidth
                    size="lg"
                  />
                </>
              ) : (
                <>
                  <View className="gap-1.5">
                    <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {labels.code}
                    </Text>
                    <Input
                      keyboardType="number-pad"
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      value={code}
                      onChangeText={setCode}
                    />
                  </View>
                  {error ? (
                    <Text className="text-destructive text-sm">{error}</Text>
                  ) : null}
                  <Button
                    label={submitting ? '…' : labels.verify}
                    onPress={verify}
                    disabled={submitting || !code}
                    fullWidth
                    size="lg"
                  />
                </>
              )}
            </Card>

            <View className="flex-row justify-center mt-6 gap-1.5">
              <Text className="text-sm text-muted-foreground">
                {labels.haveAccount}
              </Text>
              <Link href="/(auth)/sign-in" asChild>
                <Text className="text-sm text-primary font-semibold">
                  {labels.signIn}
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
