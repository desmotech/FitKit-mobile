/**
 * /onboarding/complete-profile — blocking profile-completion gate.
 *
 * Routed to by AuthGate when /users/me reports profileComplete=false
 * (and consent is already recorded). The form requires ALL fields per
 * `completeProfileSchema` from @taikan/shared — stricter than the
 * regular profile-edit form that uses `updateUserProfileSchema`.
 *
 * Structure mirrors app/(tabs)/profile/personal.tsx so the form looks
 * familiar to the user when they later return to edit it. No Cancel,
 * no back button — compliance gate.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { completeProfileSchema, type Gender } from '@taikan/shared';
import {
  FKAmbientBackdrop,
  FKBrandMark,
  FKButton,
  FKDateField,
  FKGlassPanel,
  FKSelectSheet,
  useFKColors,
} from '@/components/fk';
import { Input } from '@/components/ui/input';
import { autofill } from '@/lib/autofill';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { continuousCorners } from '@/lib/utils';
import {
  extractFieldErrors,
  formErrorSummary,
  validateProfileField,
} from '@/lib/validation-i18n';
import { reportHandledError } from '@/lib/error-reporting';
import { useI18n } from '@/providers/i18n-provider';

// The published @taikan/shared still marks the emergency-contact fields as
// required in completeProfileSchema; the form no longer collects them, so
// validate against the schema without those keys. Once the dependency picks
// up the release where they became optional, this omit is a harmless no-op.
const profileGateSchema = completeProfileSchema.omit({
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,
});

type FieldErrors = Partial<Record<string, string>>;

export default function CompleteProfileScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();
  const colors = useFKColors();
  const { dir, lang, t } = useI18n();
  const isRTL = dir === 'rtl';
  const { user } = useCurrentUser();

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const validationT = (dict.validation ?? {}) as Record<string, string>;
  const cpT = (dict.completeProfile ?? {}) as Record<string, unknown>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const genderT =
    (cpT.genderOptions as Record<Gender, string> | undefined) ?? {
      male: 'Male',
      female: 'Female',
      non_binary: 'Non-binary',
      prefer_not_to_say: 'Prefer not to say',
    };
  const labels = {
    title: (cpT.title as string) ?? 'Complete Your Profile',
    description:
      (cpT.description as string) ??
      'Please fill in your profile information to continue. All fields are required.',
    personalInfo: (cpT.personalInfo as string) ?? 'Personal Information',
    firstName: (cpT.firstName as string) ?? 'First Name',
    lastName: (cpT.lastName as string) ?? 'Last Name',
    phone: (cpT.phone as string) ?? 'Phone',
    phonePlaceholder: (cpT.phonePlaceholder as string) ?? '050-123-4567',
    nationalId: (cpT.nationalId as string) ?? 'ID Number',
    nationalIdPlaceholder: (cpT.nationalIdPlaceholder as string) ?? '9 digits',
    birthDate: (cpT.birthDate as string) ?? 'Date of Birth',
    birthDatePlaceholder: 'YYYY-MM-DD',
    gender: (cpT.gender as string) ?? 'Gender',
    selectGender: (cpT.selectGender as string) ?? 'Select gender',
    save: commonT.save ?? 'Save',
    saving: (cpT.submitting as string) ?? 'Saving…',
    cancel: commonT.cancel ?? 'Cancel',
    error: (cpT.error as string) ?? 'Failed to save profile.',
  };

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nationalId: '',
    birthDate: '',
    gender: '' as '' | Gender,
  });
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydrate once when /users/me arrives — Clerk may already have populated
  // firstName/lastName from the sign-up payload, and the user might be
  // returning to finish a partially-filled profile.
  useEffect(() => {
    if (!user || hydrated) return;
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      nationalId: '',
      birthDate: user.birthDate ?? '',
      gender: (user.gender ?? '') as '' | Gender,
    });
    setHydrated(true);
  }, [user, hydrated]);

  const update = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) {
      setErrors((p) => {
        const next = { ...p };
        delete next[k];
        return next;
      });
    }
    if (submitError) setSubmitError(null);
  };

  const handleBlur = (k: keyof typeof form) => {
    const err = validateProfileField(k, String(form[k] ?? ''), validationT);
    setErrors((p) => {
      const next = { ...p };
      if (err) next[k] = err;
      else delete next[k];
      return next;
    });
  };

  const handleSave = async () => {
    haptics.tap();
    setSubmitError(null);

    // Trim everything; completeProfileSchema enforces required-ness.
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      const trimmed = v.trim();
      if (trimmed) data[k] = trimmed;
    }

    const result = profileGateSchema.safeParse(data);
    if (!result.success) {
      setErrors(extractFieldErrors(result.error, validationT));
      setSubmitError(formErrorSummary(lang));
      haptics.error();
      return;
    }

    setSaving(true);
    try {
      await fetchWithAuth('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(result.data),
      });
      await queryClient.invalidateQueries({ queryKey: ['/users/me'] });
      haptics.success();
      // AuthGate will see profileComplete=true on next render and route
      // to the tabs; the manual replace below skips the briefly-mounted
      // onboarding shell flash.
      router.replace('/(tabs)');
    } catch (err) {
      // Raw `fetchWithAuth`, no MutationCache cover — and a silent failure
      // here strands the member in onboarding, unable to reach the app.
      reportHandledError(err, { feature: 'onboarding-complete-profile' });
      setSubmitError(labels.error);
      haptics.error();
    } finally {
      setSaving(false);
    }
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: genderT.male },
    { value: 'female', label: genderT.female },
    { value: 'non_binary', label: genderT.non_binary },
    { value: 'prefer_not_to_say', label: genderT.prefer_not_to_say },
  ];

  return (
    <View style={{ flex: 1 }}>
    <FKAmbientBackdrop />
    <SafeAreaView
      // bottom-only — top inset is applied manually on the ScrollView
      // so the layout doesn't depend on SafeAreaView's edge handling
      // (which proved inconsistent under the stack/keyboard wrappers
      // we have here).
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
            gap: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero (matches /sign-in and /onboarding/accept-terms): brand
              mark + centered 22pt semibold title + centered 13pt
              subtitle. */}
          <View
            style={{ alignItems: 'center', gap: 14, paddingBottom: 4 }}
          >
            <FKBrandMark size={56} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                numberOfLines={2}
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
                {labels.title}
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
                {labels.description}
              </Text>
            </View>
          </View>

          <FKGlassPanel radius={20} style={{ padding: 16, gap: 14 }}>
            <Row isRTL={isRTL}>
              <Field
                label={labels.firstName}
                error={errors.firstName}
                isRTL={isRTL}
              >
                <Input
                  value={form.firstName}
                  onChangeText={(v) => update('firstName', v)}
                  {...autofill('givenName')}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </Field>
              <Field
                label={labels.lastName}
                error={errors.lastName}
                isRTL={isRTL}
              >
                <Input
                  value={form.lastName}
                  onChangeText={(v) => update('lastName', v)}
                  {...autofill('familyName')}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </Field>
            </Row>

            <Field label={labels.phone} error={errors.phone} isRTL={isRTL}>
              <Input
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                onBlur={() => handleBlur('phone')}
                {...autofill('tel')}
                placeholder={labels.phonePlaceholder}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              />
            </Field>

            <Field
              label={labels.nationalId}
              error={errors.nationalId}
              isRTL={isRTL}
            >
              <Input
                value={form.nationalId}
                onChangeText={(v) =>
                  update('nationalId', v.replace(/\D/g, '').slice(0, 9))
                }
                onBlur={() => handleBlur('nationalId')}
                {...autofill('nationalId')}
                placeholder={labels.nationalIdPlaceholder}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              />
            </Field>

            <Row isRTL={isRTL}>
              <Field
                label={labels.birthDate}
                error={errors.birthDate}
                isRTL={isRTL}
              >
                {/* Native UIKit / Material date wheel via FKDateField —
                    same control used in goals/metrics. Exchanges values
                    as YYYY-MM-DD ISO strings, which is exactly what
                    completeProfileSchema expects. */}
                <FKDateField
                  value={form.birthDate}
                  onChange={(v) => update('birthDate', v)}
                  // Cap the picker at "today" — no future birth dates.
                  // We leave the minimum open (the platform picker
                  // defaults to its own minDate which is well in the
                  // past).
                  maximumDate={new Date()}
                  placeholder={labels.birthDatePlaceholder}
                />
              </Field>
              <Field
                label={labels.gender}
                error={errors.gender}
                isRTL={isRTL}
              >
                <FKSelectSheet
                  value={form.gender}
                  placeholder={labels.selectGender}
                  title={labels.gender}
                  cancelLabel={labels.cancel}
                  invalid={!!errors.gender}
                  onChange={(v) => update('gender', v)}
                  options={genderOptions}
                />
              </Field>
            </Row>
          </FKGlassPanel>

          {submitError ? (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={[
                continuousCorners,
                { borderRadius: 12, padding: 12 },
              ]}
              className="bg-destructive/[0.10]"
            >
              <Text className="text-destructive" style={{ fontSize: 13 }}>
                {submitError}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(80).duration(280)}>
            <FKButton
              label={saving ? labels.saving : labels.save}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleSave}
              disabled={saving}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

function Row({
  children,
  isRTL,
}: {
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

function Field({
  label,
  error,
  isRTL,
  children,
}: {
  label: string;
  error?: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
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
      {error ? (
        <Text
          className="text-destructive"
          style={{
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
