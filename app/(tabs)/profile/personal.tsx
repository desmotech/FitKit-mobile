/**
 * Personal Details — mirror of web's `/profile/personal`. Edits
 * first/last name, phone, national ID, birth date, gender, emergency
 * contact. PATCHes `/users/me`. Validates against
 * `updateUserProfileSchema` (loose: only non-empty fields are submitted).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  type Gender,
  type Relationship,
  relationshipValues,
  updateUserProfileSchema,
} from '@fitkit/shared';
import {
  FKBtn,
  FKGlassPanel,
  FKSelectSheet,
  FKSubScreen,
} from '@/components/fk';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useI18n } from '@/providers/i18n-provider';

type FieldErrors = Partial<Record<string, string>>;

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { dir, lang, t } = useI18n();
  const isRTL = dir === 'rtl';

  const validationT = (t as unknown as Record<string, Record<string, string>>).validation ?? {};
  const profileT = (t as unknown as Record<string, Record<string, unknown>>).profile ?? {};
  const cpT = (t as unknown as Record<string, Record<string, unknown>>).completeProfile ?? {};
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};
  const settingsT = (profileT.settings ?? {}) as Record<string, string>;
  const genderT = (cpT.genderOptions ?? {}) as Record<Gender, string>;
  const emergencyT = (cpT.emergency ?? {}) as Record<string, unknown>;
  const relT = (emergencyT.relationshipOptions ?? {}) as Record<Relationship, string>;

  const labels = {
    title: settingsT.personal ?? 'Personal Details',
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
    emergencyTitle: (emergencyT.title as string) ?? 'Emergency Contact',
    emergencyName: (emergencyT.name as string) ?? 'Contact Name',
    emergencyPhone: (emergencyT.phone as string) ?? 'Contact Phone',
    emergencyRelationship: (emergencyT.relationship as string) ?? 'Relationship',
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
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '' as '' | Relationship,
  });
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydrate once when the user payload arrives.
  if (user && !hydrated) {
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      nationalId: '',
      birthDate: user.birthDate ?? '',
      gender: (user.gender ?? '') as '' | Gender,
      emergencyContactName: user.emergencyContactName ?? '',
      emergencyContactPhone: user.emergencyContactPhone ?? '',
      emergencyContactRelationship: (user.emergencyContactRelationship ?? '') as '' | Relationship,
    });
    setHydrated(true);
  }

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

    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      const trimmed = v.trim();
      if (trimmed) data[k] = trimmed;
    }

    const result = updateUserProfileSchema.safeParse(data);
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
      router.back();
    } catch {
      setSubmitError(labels.error);
      haptics.error();
    } finally {
      setSaving(false);
    }
  };

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: genderT.male ?? 'Male' },
    { value: 'female', label: genderT.female ?? 'Female' },
    { value: 'non_binary', label: genderT.non_binary ?? 'Non-binary' },
    { value: 'prefer_not_to_say', label: genderT.prefer_not_to_say ?? 'Prefer not to say' },
  ];

  return (
    <FKSubScreen
      title={labels.title}
      keyboardAvoiding
      contentStyle={{ gap: 18 }}
      actions={
        <>
          <FKBtn
            variant="ghost"
            full
            label={labels.cancel}
            onPress={() => router.back()}
            disabled={saving}
          />
          <FKBtn
            variant="primary"
            full
            label={saving ? labels.saving : labels.save}
            onPress={handleSave}
            disabled={saving}
          />
        </>
      }
    >
          {isLoading && !hydrated ? (
            <Skeleton style={{ height: 320, borderRadius: 20 }} />
          ) : (
            <>
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
                      autoCapitalize="words"
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
                      autoCapitalize="words"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </Field>
                </Row>

                <Field
                  label={labels.phone}
                  error={errors.phone}
                  isRTL={isRTL}
                >
                  <Input
                    value={form.phone}
                    onChangeText={(v) => update('phone', v)}
                    onBlur={() => handleBlur('phone')}
                    keyboardType="phone-pad"
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
                    keyboardType="number-pad"
                    placeholder={
                      user?.nationalIdMasked ?? labels.nationalIdPlaceholder
                    }
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </Field>

                <Row isRTL={isRTL}>
                  <Field
                    label={labels.birthDate}
                    error={errors.birthDate}
                    isRTL={isRTL}
                  >
                    <Input
                      value={form.birthDate}
                      onChangeText={(v) => update('birthDate', v)}
                      placeholder={labels.birthDatePlaceholder}
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                      style={{
                        textAlign: isRTL ? 'right' : 'left',
                        fontFamily: 'DMMono',
                      }}
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

              <FKGlassPanel radius={20} style={{ padding: 16, gap: 14 }}>
                <Text
                  className="text-muted-foreground"
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {labels.emergencyTitle}
                </Text>

                <Field
                  label={labels.emergencyName}
                  error={errors.emergencyContactName}
                  isRTL={isRTL}
                >
                  <Input
                    value={form.emergencyContactName}
                    onChangeText={(v) => update('emergencyContactName', v)}
                    autoCapitalize="words"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </Field>

                <Row isRTL={isRTL}>
                  <Field
                    label={labels.emergencyPhone}
                    error={errors.emergencyContactPhone}
                    isRTL={isRTL}
                  >
                    <Input
                      value={form.emergencyContactPhone}
                      onChangeText={(v) =>
                        update('emergencyContactPhone', v)
                      }
                      onBlur={() => handleBlur('emergencyContactPhone')}
                      keyboardType="phone-pad"
                      placeholder={labels.phonePlaceholder}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </Field>
                  <Field
                    label={labels.emergencyRelationship}
                    error={errors.emergencyContactRelationship}
                    isRTL={isRTL}
                  >
                    <FKSelectSheet
                      value={form.emergencyContactRelationship}
                      placeholder={(emergencyT.selectRelationship as string) ?? 'Select'}
                      title={labels.emergencyRelationship}
                      cancelLabel={labels.cancel}
                      invalid={!!errors.emergencyContactRelationship}
                      onChange={(v) =>
                        update('emergencyContactRelationship', v)
                      }
                      options={relationshipValues.map((r) => ({
                        value: r,
                        label: relT[r] ?? r,
                      }))}
                    />
                  </Field>
                </Row>
              </FKGlassPanel>

              {submitError && (
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
              )}

            </>
          )}
    </FKSubScreen>
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
          letterSpacing: 0.6,
          textTransform: 'uppercase',
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

