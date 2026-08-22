/**
 * <LegalConsentForm> — port of apps/web LegalAcceptanceForm.
 *
 * Visual rules:
 *   - Each consent line is a row with a 24pt checkbox tile + a Text body
 *     containing inline document links.
 *   - Doc links render as underlined teal "buttons" that open the doc in
 *     an in-app Safari View Controller (see legal-doc-viewer.tsx).
 *   - Two consents per legal advice — "core" (terms + privacy together)
 *     and "waiver" (fitness waiver alone). Both must be checked to enable
 *     submit.
 *   - Audit note below the checkboxes is a 12pt mute footnote with a
 *     shield icon (same iconography as web for trust-signal continuity).
 *
 * Submit:
 *   - Records all three doc types (terms_of_use, privacy_policy,
 *     fitness_waiver) in a single POST /legal/consents call. Web does
 *     the same — three separate checkboxes would be busier without
 *     adding legal precision.
 *   - On success, invalidates /users/me so the AuthGate sees
 *     pendingLegalConsents=false on the next render.
 *
 * Variants:
 *   - `standalone={true}`: renders the submit button inside the form.
 *     Used by the /onboarding/accept-terms screen.
 *   - `standalone={false}`: parent owns the submit — the form notifies
 *     `onAccepted()` whenever both boxes are checked. Reserved for a
 *     future owner-onboarding wizard.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ConsentContext, LegalDocumentType } from '@taikan/shared';
import { setAnalyticsConsent } from '@/lib/analytics';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useRecordConsent } from '@/hooks/use-legal';
import { useI18n } from '@/providers/i18n-provider';
import { openLegalDoc } from './legal-doc-viewer';

const BRAND_TEAL = '#0E8C8C';

export interface LegalConsentFormProps {
  context: ConsentContext;
  organizationId?: string;
  /** Fires after a successful POST /legal/consents (or whenever both
   *  boxes are checked, when `standalone` is false). */
  onAccepted: () => void;
  /** Render the inline submit button. Default true. */
  standalone?: boolean;
  /** Optional: shown as an info banner above the form when the user is
   *  re-consenting because of an updated document version. */
  updatedDocTypes?: LegalDocumentType[];
}

export function LegalConsentForm({
  context,
  organizationId,
  onAccepted,
  standalone = true,
  updatedDocTypes,
}: LegalConsentFormProps) {
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const mutation = useRecordConsent();

  const legalT = (t as unknown as Record<string, Record<string, unknown>>)
    .legal as Record<string, unknown> | undefined;
  const docNamesT =
    (legalT?.docNames as Record<LegalDocumentType, string> | undefined) ?? {
      terms_of_use: 'Terms of Use',
      privacy_policy: 'Privacy Policy',
      fitness_waiver: 'Fitness Waiver',
      cookie_policy: 'Cookie Policy',
      acceptable_use: 'Acceptable Use Policy',
    };
  const labels = {
    updatedBanner:
      (legalT?.updatedBanner as string) ??
      "We've updated our legal documents. Please review and accept the latest versions to continue.",
    coreConsentPrefix:
      (legalT?.coreConsentPrefix as string) ?? 'I have read and agree to the',
    and: (legalT?.and as string) ?? 'and',
    waiverConsentPrefix:
      (legalT?.waiverConsentPrefix as string) ?? 'I acknowledge and accept the',
    auditNote:
      (legalT?.auditNote as string) ??
      'Your acceptance is securely recorded with a timestamp for compliance purposes.',
    submit: (legalT?.submit as string) ?? 'Accept & Continue',
    submitting: (legalT?.submitting as string) ?? 'Saving…',
    submitError:
      (legalT?.submitError as string) ??
      'Failed to record your acceptance. Please try again.',
    analyticsConsentLabel:
      (legalT?.analyticsConsentLabel as string) ??
      'Share anonymous usage data to help improve Taikan.',
    analyticsConsentHint:
      (legalT?.analyticsConsentHint as string) ??
      'Optional. You can change this anytime in Profile.',
  };

  const [coreAccepted, setCoreAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  // Optional — defaults OFF (decline-by-default, matching web). Does NOT gate
  // submit; persisted + applied to PostHog only after a successful accept.
  const [analyticsAccepted, setAnalyticsAccepted] = useState(false);
  const allChecked = coreAccepted && waiverAccepted;

  // In embedded mode, notify parent once both boxes are ticked.
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;
  useEffect(() => {
    if (!standalone && allChecked) {
      onAcceptedRef.current();
    }
  }, [standalone, allChecked]);

  const handleSubmit = () => {
    if (!allChecked || mutation.isPending) return;
    haptics.tap();
    mutation.mutate(
      {
        types: ['terms_of_use', 'privacy_policy', 'fitness_waiver'],
        context,
        ...(organizationId ? { organizationId } : {}),
      },
      {
        onSuccess: async () => {
          haptics.success();
          // CRITICAL: await a real refetch before navigating. AuthGate
          // re-derives needsLegalConsent from /legal/consents/status —
          // if we redirect to /(tabs) while the cache is still stale
          // (needs: true), AuthGate ping-pongs us back to this screen.
          // refetchType:'all' is required: this screen has no active
          // observer of the status query (AuthGate unmounted when it
          // redirected here), so the default 'active' invalidate would
          // be a no-op and leave the stale value in cache. See
          // useNeedsLegalConsent for why status is the single source of
          // truth (not the user.pendingLegalConsents flag).
          await queryClient.invalidateQueries({
            queryKey: ['/legal/consents/status'],
            refetchType: 'all',
          });
          // Apply the optional analytics choice now that legal acceptance
          // succeeded. Local-only preference (mirrors web's cookie consent).
          setAnalyticsConsent(analyticsAccepted);
          onAccepted();
        },
        onError: () => haptics.error(),
      },
    );
  };

  const mutedFg = isDark
    ? 'rgba(238,242,246,0.6)'
    : 'rgba(60,60,67,0.6)';

  return (
    <View style={{ gap: 16 }}>
      {/* Updated-docs banner (rare path — fires when a deployed doc
          version bumps and the user has to re-accept). */}
      {updatedDocTypes && updatedDocTypes.length > 0 ? (
        <View
          style={{
            borderRadius: 12,
            borderCurve: 'continuous',
            padding: 12,
            backgroundColor: isDark
              ? 'rgba(245,158,11,0.16)'
              : 'rgba(245,158,11,0.10)',
            borderWidth: 1,
            borderColor: isDark
              ? 'rgba(245,158,11,0.40)'
              : 'rgba(245,158,11,0.30)',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isDark ? '#FBBF24' : '#92400E',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.updatedBanner}
          </Text>
        </View>
      ) : null}

      {/* Core consent — Terms + Privacy together */}
      <ConsentRow
        accessibilityLabel={`${labels.coreConsentPrefix} ${docNamesT.terms_of_use} ${labels.and} ${docNamesT.privacy_policy}`}
        checked={coreAccepted}
        onToggle={() => {
          haptics.select();
          setCoreAccepted((v) => !v);
        }}
        isRTL={isRTL}
      >
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 22,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          <Text>{labels.coreConsentPrefix} </Text>
          <DocLink type="terms_of_use" label={docNamesT.terms_of_use} />
          <Text> {labels.and} </Text>
          <DocLink type="privacy_policy" label={docNamesT.privacy_policy} />
          <Text>.</Text>
        </Text>
      </ConsentRow>

      {/* Waiver consent */}
      <ConsentRow
        accessibilityLabel={`${labels.waiverConsentPrefix} ${docNamesT.fitness_waiver}`}
        checked={waiverAccepted}
        onToggle={() => {
          haptics.select();
          setWaiverAccepted((v) => !v);
        }}
        isRTL={isRTL}
      >
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 22,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          <Text>{labels.waiverConsentPrefix} </Text>
          <DocLink type="fitness_waiver" label={docNamesT.fitness_waiver} />
          <Text>.</Text>
        </Text>
      </ConsentRow>

      {/* Optional analytics consent — does NOT gate submit. Decline-by-default
          like web's cookie banner; withdrawable later in Profile > Privacy. */}
      <ConsentRow
        accessibilityLabel={labels.analyticsConsentLabel}
        checked={analyticsAccepted}
        onToggle={() => {
          haptics.select();
          setAnalyticsAccepted((v) => !v);
        }}
        isRTL={isRTL}
      >
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 22,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.analyticsConsentLabel}
        </Text>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 16,
            color: mutedFg,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.analyticsConsentHint}
        </Text>
      </ConsentRow>

      {/* Audit note */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ShieldCheck size={16} color="#16A34A" strokeWidth={2.2} />
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            color: mutedFg,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.auditNote}
        </Text>
      </View>

      {/* Inline error */}
      {mutation.error ? (
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
            {labels.submitError}
          </Text>
        </View>
      ) : null}

      {/* Standalone submit — View wraps the visual props so they survive
          Hermes' Pressable-style-function stripping bug. Inner Pressable
          is the touch target only. */}
      {standalone ? (
        <View
          style={{
            height: 52,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor:
              !allChecked || mutation.isPending
                ? 'rgba(14,140,140,0.45)'
                : BRAND_TEAL,
            shadowColor: '#000',
            shadowOpacity: !allChecked || mutation.isPending ? 0 : 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            overflow: 'hidden',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.submit}
            accessibilityState={{ disabled: !allChecked || mutation.isPending }}
            disabled={!allChecked || mutation.isPending}
            onPress={handleSubmit}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: '#fff',
                letterSpacing: -0.4,
              }}
            >
              {mutation.isPending ? labels.submitting : labels.submit}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function ConsentRow({
  checked,
  onToggle,
  accessibilityLabel,
  isRTL,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  // View-wrapped Pressable per the project's RN pattern — keeps the
  // 24pt visual checkbox border/bg stable.
  const tile = (
    <View
      key="box"
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: checked ? BRAND_TEAL : 'rgba(61,90,112,0.40)',
        backgroundColor: checked ? BRAND_TEAL : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
      }}
    >
      {checked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
    </View>
  );
  const body = (
    <View key="body" style={{ flex: 1 }}>
      {children}
    </View>
  );
  const rowChildren = isRTL ? [body, tile] : [tile, body];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {rowChildren}
    </Pressable>
  );
}

function DocLink({
  type,
  label,
}: {
  type: LegalDocumentType;
  label: string;
}) {
  return (
    <Text
      onPress={() => openLegalDoc(type)}
      style={{
        color: BRAND_TEAL,
        fontWeight: '700',
        textDecorationLine: 'underline',
      }}
    >
      {label}
    </Text>
  );
}
