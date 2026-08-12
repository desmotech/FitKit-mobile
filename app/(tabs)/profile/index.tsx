/**
 * Profile screen — port of `11-FitKit Fitness - Profile (Acco).html`.
 *
 * Layout (top → bottom):
 *   1. Sticky glass header: bell + title + brand mark
 *   2. Centered avatar with brand glow + edit pip
 *   3. Display name + member-since subtitle
 *   4. 3-up stat strip (workouts / PRs / streak)
 *   5. Membership card (brand-tinted glass)
 *   6. Grouped settings cards (Account, Activity, Theme/Lang, Support)
 *   7. Sign-out button
 *   8. Footer legal links + version
 *
 * Labels live in `@/i18n/profile-strings` (dictionary-first via
 * `useProfileStrings`); the avatar flow lives in
 * `@/hooks/use-avatar-upload`.
 */
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Bell,
  Building2,
  CreditCard,
  FileSignature,
  Globe,
  Goal,
  History,
  Camera,
  Scale,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Smartphone,
  Pencil,
  Phone,
  ShieldCheck,
  Sun,
  Trash2,
  Trophy,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { Fragment } from 'react';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  FKAmbientBackdrop,
  FKGlassPanel,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { displayFamily } from '@/lib/type';
import { useAvatarUpload } from '@/hooks/use-avatar-upload';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useEarlyRenewSubscription,
  useMyPersonalRecords,
  useMyStats,
  useMySubscription,
  useRenewSubscription,
} from '@/hooks/use-feed-data';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useIncompleteFormsCount } from '@/hooks/use-forms';
import { useHaptics } from '@/hooks/use-haptics';
import { revokeCurrentDeviceToken } from '@/hooks/use-push-notifications';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { i18n, type Locale } from '@/i18n/config';
import { useProfileStrings } from '@/i18n/use-profile-strings';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import {
  earlyRenewErrorMessage,
  useEarlyRenewStrings,
} from '@/i18n/use-early-renew-strings';
import { ApiError } from '@/hooks/use-api';
import { EARLY_RENEWAL_FLAG } from '@/lib/early-renew';
import { formatPrice } from '@/lib/format-price';
import { getPlanChangeSchedule } from '@/lib/plan-change';
import { queryKeys } from '@/lib/query-keys';
import { resetClientSession } from '@/lib/session-reset';
import { useActiveOrg } from '@/providers/active-org-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemePreference } from '@/providers/theme-provider';
import { RecentPRs } from '@/components/profile/recent-prs';
import { HeroStat } from '@/components/profile/hero-stat';
import { MembershipCard } from '@/components/profile/membership-card';
import {
  RowDivider,
  SegmentedRow,
  SettingsGroup,
  SettingsRow,
  SettingsSectionHeader,
} from '@/components/profile/settings';

/** One tappable row in a settings group — see `renderRows` in the screen. */
type SettingsRowConfig = {
  key: string;
  Icon: LucideIcon;
  label: string;
  sublabel?: string;
  /** Per-row icon color (design's colorful icons). Falls back to muted. */
  iconTint?: string;
  badgeCount?: number;
  onPress: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { dir, lang, setLang, t } = useI18n();
  const { user, activeOrganization, isLoading: userLoading } = useCurrentUser();
  const { clearActiveOrg } = useActiveOrg();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { avatarBusy, onEditAvatar } = useAvatarUpload();
  const haptics = useHaptics();
  // `colorScheme` is the *resolved* scheme (used for `isDark` styling);
  // `preference` is the user's persisted choice (light/dark/system) that
  // drives the Theme control.
  const { colorScheme } = useColorScheme();
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemePreference();
  const colors = useFKColors();
  const bottomPad = useTabBarPadding(32);
  // All screen labels — dictionary-first with per-language static fallbacks.
  const labels = useProfileStrings();
  const errorStrings = usePaymentErrorStrings();
  const earlyRenewT = useEarlyRenewStrings();

  const orgId = activeOrganization?.id;
  const incompleteForms = useIncompleteFormsCount(orgId);
  const stats = useMyStats(orgId);
  const prs = useMyPersonalRecords(orgId);
  const subs = useMySubscription(orgId);
  const renew = useRenewSubscription(orgId);
  const earlyRenew = useEarlyRenewSubscription(orgId);
  // Shares FIT-282's presale-terms flag rather than getting its own — see
  // src/lib/early-renew.ts.
  const earlyRenewalEnabled = useFeatureFlag(EARLY_RENEWAL_FLAG);
  const queryClient = useQueryClient();

  // The membership card's status labels stay on the raw dictionary — they
  // are a pass-through map keyed by status, not individual labels.
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const profileT = (dict.profile ?? {}) as Record<string, unknown>;
  const membershipT = (profileT.membership ?? {}) as Record<string, unknown>;
  const membershipStatusT = (membershipT.status ?? {}) as Record<string, string>;

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || '?';
  // Clerk always serves a generated placeholder via imageUrl; only treat a
  // real upload (hasImage) as an avatar so the fallback shows brand initials.
  const avatarUrl = clerkUser
    ? clerkUser.hasImage
      ? clerkUser.imageUrl
      : null
    : (user?.imageUrl ?? null);
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    '—';
  const classesThisMonth = (stats.data?.data?.classesThisMonth as number) ?? 0;
  const totalClasses = (stats.data?.data?.totalClasses as number) ?? 0;
  // Drop the row a plan change left behind: it's cancelled only because it
  // was replaced, so showing it reads as "your membership ended" next to the
  // membership that actually replaced it.
  const subList = (subs.data?.data ?? []).filter(
    (s) =>
      (s as unknown as { cancellationReason?: string | null })
        .cancellationReason !== 'plan_change',
  );
  // FIT-282 follow-up (early renewal, BoostApp parity): once the month
  // quota is gone, offer to pay now and open a new period rather than wait
  // out days the member can't book with. Gated the same way the server
  // enforces it — a scheduled plan change or cancellation already decides
  // what happens at period end, so early-renewing under one would fight it.
  const primarySub = subList[0] as
    | (typeof subList)[0] & {
        quotas?: { period: string; remaining: number }[] | null;
        cancelAtPeriodEnd?: boolean | null;
        effectivePriceInCents?: number | null;
      }
    | undefined;
  const exhaustedMonthQuota = primarySub?.quotas?.find(
    (q) => q.period === 'month' && q.remaining === 0,
  );
  const canRenewEarly =
    earlyRenewalEnabled &&
    primarySub?.status === 'active' &&
    primarySub.plan.type === 'subscription' &&
    !!exhaustedMonthQuota &&
    !primarySub.cancelAtPeriodEnd &&
    !getPlanChangeSchedule(primarySub as never);
  const prCount = (prs.data?.data ?? []).length;
  const recentPRRecords = [...(prs.data?.data ?? [])]
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 3);
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';

  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';
  const FITKIT_SUPPORT_EMAIL = 'support@fitkit.fit';
  const FITKIT_WEBSITE = 'https://fitkit.fit';

  // "Member since YYYY" — derive from user.createdAt if present, else fall
  // back to the org name. `labels.memberSince` template carries `{year}` for
  // locale-correct word order (Hebrew puts the year *after* the noun).
  const createdYear = (user as unknown as { createdAt?: string })?.createdAt
    ? new Date((user as unknown as { createdAt: string }).createdAt).getFullYear()
    : null;
  const memberSinceLine = createdYear
    ? labels.memberSince.includes('{year}')
      ? labels.memberSince.replace('{year}', String(createdYear))
      : `${labels.memberPrefix} ${createdYear}`
    : (activeOrganization?.name ?? 'FitKit');

  // FIT-282 follow-up (early renewal, BoostApp parity) — confirm-then-charge:
  // this alert IS the confirmation step, no silent auto-charge. Mirrors
  // web's early-renew-dialog.tsx.
  const handleRenewEarly = () => {
    if (!primarySub || earlyRenew.isPending) return;
    const amount = formatPrice(
      primarySub.effectivePriceInCents ?? primarySub.plan.priceInCents,
      primarySub.plan.currency,
      lang,
    );
    const date = primarySub.currentPeriodEnd
      ? new Date(primarySub.currentPeriodEnd).toLocaleDateString(lang)
      : '';
    haptics.tap();
    Alert.alert(
      earlyRenewT.cta,
      earlyRenewT.description.replace('{amount}', amount).replace('{date}', date),
      [
        { text: earlyRenewT.cancel, style: 'cancel' },
        {
          text: earlyRenewT.confirmAction.replace('{amount}', amount),
          onPress: () => {
            earlyRenew.mutate(primarySub.id, {
              onSuccess: () => {
                haptics.success();
                queryClient.invalidateQueries({
                  queryKey: queryKeys.subscriptions.all(orgId!, { mine: true }),
                });
                Alert.alert('', earlyRenewT.success);
              },
              onError: (err) => {
                haptics.error();
                const code = err instanceof ApiError ? err.code : undefined;
                Alert.alert('', earlyRenewErrorMessage(earlyRenewT, code));
              },
            });
          },
        },
      ],
    );
  };

  const handleSignOut = () =>
    Alert.alert(labels.signOutTitle, undefined, [
      { text: labels.signOutCancel, style: 'cancel' },
      {
        text: labels.signOutConfirm,
        style: 'destructive',
        onPress: async () => {
          // Revoke the push token BEFORE Clerk drops the session — the
          // server call needs a valid bearer to authenticate.
          try {
            const jwt = await getToken();
            await revokeCurrentDeviceToken(jwt);
          } catch {
            // Best-effort — server reaps dead tokens on next send anyway.
          }
          // Drop the session FIRST, then clear. The other order looks
          // harmless but isn't: while the session is still live every
          // mounted screen's query is enabled, so `clear()` makes them all
          // refetch with the outgoing user's token and the persister's
          // throttled write puts that data straight back on disk — where
          // the next sign-in restores it. Signing out first disables the
          // queries (`useApiQuery` gates on `isSignedIn`), so nothing
          // repopulates what we erase.
          await signOut();
          try {
            clearActiveOrg();
            await resetClientSession(queryClient);
          } catch {
            // Best-effort — never block sign-out on it. SessionGuard runs
            // the same reset when it sees the identity change.
          }
          router.replace('/(auth)/sign-in');
        },
      },
    ]);

  // ── Settings rows as data ─────────────────────────────────────────
  // Each group renders one of these arrays via `renderRows`, which
  // interleaves hairline dividers between rows — identical output to the
  // previous hand-written row/divider JSX.
  const accountRows: SettingsRowConfig[] = [
    {
      key: 'personal',
      Icon: UserIcon,
      iconTint: colors.primary,
      label: labels.settingPersonal,
      onPress: () => router.push('/(tabs)/profile/personal'),
    },
    {
      key: 'goals',
      Icon: Goal,
      iconTint: '#E0552F',
      label: labels.settingGoals,
      onPress: () => router.push('/(tabs)/profile/goals'),
    },
    {
      key: 'prs',
      Icon: Trophy,
      iconTint: '#B07D2A',
      label: labels.settingPrs,
      onPress: () => router.push('/(tabs)/profile/prs'),
    },
    {
      key: 'metrics',
      Icon: Scale,
      iconTint: '#5E8A4E',
      label: labels.settingMetrics,
      onPress: () => router.push('/(tabs)/profile/metrics'),
    },
    {
      key: 'photos',
      Icon: Camera,
      iconTint: '#B07D2A',
      label: labels.settingPhotos,
      onPress: () => router.push('/(tabs)/profile/photos'),
    },
    {
      key: 'forms',
      Icon: FileSignature,
      iconTint: '#C0524A',
      label: labels.settingForms,
      badgeCount: incompleteForms,
      onPress: () => router.push('/(tabs)/profile/forms'),
    },
  ];

  const activityRows: SettingsRowConfig[] = [
    {
      key: 'history',
      Icon: History,
      iconTint: colors.primary,
      label: labels.settingHistory,
      onPress: () => router.push('/(tabs)/profile/history'),
    },
    {
      key: 'payments',
      Icon: CreditCard,
      iconTint: '#B07D2A',
      label: labels.settingPayment,
      onPress: () => router.push('/(tabs)/profile/payments'),
    },
  ];

  // Org contact rows — each is present only when the org has that field;
  // the org name header renders whenever there's an active org.
  const orgContactRows: SettingsRowConfig[] = [
    ...(activeOrganization?.contactEmail
      ? [
          {
            key: 'email',
            Icon: Mail,
            label: labels.contactEmail,
            sublabel: activeOrganization.contactEmail,
            onPress: () =>
              Linking.openURL(`mailto:${activeOrganization.contactEmail}`),
          },
        ]
      : []),
    ...(activeOrganization?.contactPhone
      ? [
          {
            key: 'phone',
            Icon: Phone,
            label: labels.contactPhone,
            sublabel: activeOrganization.contactPhone,
            onPress: () =>
              Linking.openURL(`tel:${activeOrganization.contactPhone}`),
          },
        ]
      : []),
    ...(activeOrganization?.website
      ? [
          {
            key: 'website',
            Icon: Globe,
            label: labels.contactWebsite,
            sublabel: activeOrganization.website,
            onPress: () => Linking.openURL(activeOrganization.website ?? ''),
          },
        ]
      : []),
  ];

  const fitkitRows: SettingsRowConfig[] = [
    {
      key: 'feedback',
      Icon: MessageSquare,
      label: labels.fitkitFeedback,
      onPress: () => router.push('/(tabs)/profile/feedback'),
    },
    {
      key: 'contact',
      Icon: LifeBuoy,
      label: labels.fitkitContact,
      sublabel: FITKIT_SUPPORT_EMAIL,
      onPress: () =>
        Linking.openURL(
          `mailto:${FITKIT_SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `FitKit support — v${appVersion}`,
          )}`,
        ),
    },
    {
      key: 'website',
      Icon: Globe,
      label: labels.fitkitWebsite,
      sublabel: 'fitkit.fit',
      onPress: () => Linking.openURL(FITKIT_WEBSITE),
    },
  ];

  const renderRows = (rows: SettingsRowConfig[]) =>
    rows.map(({ key, ...row }, index) => (
      <Fragment key={key}>
        {index > 0 && <RowDivider isDark={isDark} />}
        <SettingsRow {...row} isRTL={isRTL} colors={colors} isDark={isDark} />
      </Fragment>
    ));

  return (
    // No `direction: dir` style — RN double-flips when both `direction` and
    // explicit `flexDirection: row-reverse` are present. We handle layout
    // direction manually via `isRTL`.
    <View className="flex-1">
      <FKAmbientBackdrop />
      {/* ── Unified org header (shared across Home + Whiteboard + Profile) */}
      <MemberHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── HERO — centered identity over the ambient backdrop */}
        <Animated.View
          entering={FadeInDown.duration(420).springify()}
          style={{ alignItems: 'center', paddingTop: 16, paddingHorizontal: 20 }}
        >
          <View style={{ position: 'relative' }}>
                  <View
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 46,
                      borderWidth: 1,
                      borderColor: colors.isDark
                        ? 'rgba(53,196,187,0.35)'
                        : 'rgba(14,140,140,0.25)',
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.isDark
                        ? 'rgba(53,196,187,0.12)'
                        : 'rgba(14,140,140,0.10)',
                      boxShadow: '0 8px 28px rgba(14,140,140,0.30)',
                    }}
                  >
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Text
                        className="font-display"
                        style={{
                          color: colors.isDark ? '#35C4BB' : '#0E8C8C',
                          fontSize: 32,
                          lineHeight: 38,
                          fontWeight: '800',
                          letterSpacing: -0.5,
                        }}
                      >
                        {initials.toUpperCase()}
                      </Text>
                    )}
                    {avatarBusy ? (
                      <View
                        style={{
                          position: 'absolute',
                          inset: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(0,0,0,0.35)',
                        }}
                      >
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onEditAvatar}
                    onPressIn={haptics.tap}
                    disabled={avatarBusy}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      [isRTL ? 'left' : 'right']: -2,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.06)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.16)',
                    }}
                  >
                    <Pencil size={12} color="#0E8C8C" strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>

                {userLoading ? (
                  <Skeleton
                    style={{ width: 160, height: 28, borderRadius: 8, marginTop: 14 }}
                  />
                ) : (
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 14,
                      fontSize: 26,
                      lineHeight: 32,
                      color: colors.foreground,
                      letterSpacing: -0.5,
                      textAlign: 'center',
                      fontFamily: displayFamily(lang, 'bold'),
                    }}
                  >
                    {displayName}
                  </Text>
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    color: colors.mutedFg,
                    fontWeight: '500',
                    marginTop: 3,
                    textAlign: 'center',
                  }}
                >
                  {memberSinceLine}
                </Text>
                <View
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 11,
                    paddingVertical: 4.5,
                    borderRadius: 999,
                    backgroundColor: colors.isDark
                      ? 'rgba(53,196,187,0.16)'
                      : 'rgba(14,140,140,0.12)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: colors.isDark ? '#35C4BB' : '#0E8C8C',
                      letterSpacing: 0.5,
                    }}
                  >
                    {labels.activeMembership.toUpperCase()}
                  </Text>
                </View>
              </Animated.View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 24 }}>
          {/* ── 3-up stat strip — glass panel, hairline dividers ── */}
          <FKGlassPanel
            radius={20}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              paddingVertical: 16,
              paddingHorizontal: 8,
            }}
          >
            <HeroStat
              value={classesThisMonth}
              label={labels.thisMonth}
              lang={lang}
              color={colors.foreground}
              labelColor={colors.mutedFg}
            />
            <View
              style={{
                width: 1,
                marginVertical: 4,
                backgroundColor: colors.isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(60,60,67,0.14)',
              }}
            />
            <HeroStat
              value={prCount}
              label={labels.newPrsLabel}
              lang={lang}
              accent={colors.isDark ? '#EAC35E' : '#B07D2A'}
              labelColor={colors.mutedFg}
            />
            <View
              style={{
                width: 1,
                marginVertical: 4,
                backgroundColor: colors.isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(60,60,67,0.14)',
              }}
            />
            <HeroStat
              value={totalClasses}
              label={labels.totalWods}
              lang={lang}
              color={colors.foreground}
              labelColor={colors.mutedFg}
            />
          </FKGlassPanel>
          {/* ── Recent PRs (scoreboard) ────────────────────────── */}
          {recentPRRecords.length > 0 ? (
            <RecentPRs
              records={recentPRRecords}
              title={labels.recentPrsTitle}
              newLabel={labels.newBadge}
              isRTL={isRTL}
              colors={colors}
              lang={lang}
            />
          ) : null}

          {/* ── Membership status ──────────────────────────────── */}
          {subs.isLoading ? (
            <Skeleton style={{ height: 132, borderRadius: 20 }} />
          ) : subList.length === 0 ? (
            <FKGlassPanel
              radius={20}
              style={{
                padding: 20,
                gap: 12,
                alignItems: 'center',
              }}
            >
              <Text
                style={{ fontSize: 14, color: colors.mutedFg, textAlign: 'center' }}
              >
                {labels.noPlan}
              </Text>
              <Pressable
                onPressIn={haptics.tap}
                onPress={() => router.push('/(tabs)/shop')}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: '#0E8C8C',
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                  {labels.browsePlans}
                </Text>
              </Pressable>
            </FKGlassPanel>
          ) : (
            <MembershipCard
              // `quotas` + `introCyclesRemaining` ride along on the
              // subscription payload; mobile's pinned @fitkit/shared predates
              // both, so the card types them structurally and renders them
              // only when the API actually sends them.
              sub={subList[0]}
              isRTL={isRTL}
              colors={colors}
              statusLabels={membershipStatusT}
              labels={{
                title: labels.membershipTitle,
                active: labels.activeMembership,
                expires: labels.expires,
                manage: labels.managePlan,
                renew: labels.renew,
                renewing: labels.renewing,
                completePayment: labels.completePayment,
                updateCard: labels.updateCard,
                endedByGym: labels.endedByGym,
              }}
              isRenewing={renew.isPending && renew.variables === subList[0].id}
              onRenew={() => {
                haptics.tap();
                renew.mutate(subList[0].id, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.subscriptions.all(orgId!, { mine: true }),
                    });
                    haptics.success();
                  },
                  // Surface C1's structured failures; the no-card case
                  // routes to Payments, where card registration lives.
                  onError: (err) => {
                    haptics.error();
                    const message = paymentErrorMessage(
                      errorStrings,
                      err,
                      lang,
                      errorStrings.renewFailed,
                      'subscription-renew',
                    );
                    if (
                      err instanceof ApiError &&
                      err.code === 'no_active_payment_method'
                    ) {
                      Alert.alert('', message, [
                        { text: errorStrings.cancel, style: 'cancel' },
                        {
                          text: errorStrings.addCard,
                          onPress: () =>
                            router.push('/(tabs)/profile/payments'),
                        },
                      ]);
                    } else {
                      Alert.alert('', message);
                    }
                  },
                });
              }}
              canRenewEarly={canRenewEarly}
              isRenewingEarly={earlyRenew.isPending}
              onRenewEarly={handleRenewEarly}
            />
          )}

          {/* ── Settings groups ────────────────────────────────── */}
          <SettingsGroup colors={colors} isRTL={isRTL}>
            {renderRows(accountRows)}
          </SettingsGroup>

          <SettingsGroup colors={colors} isRTL={isRTL}>
            {renderRows(activityRows)}
          </SettingsGroup>


          {/* Theme + Language segmented controls — icon-only, brand-tinted active */}
          <FKGlassPanel radius={20} style={{ padding: 16, gap: 16 }}>
            <SegmentedRow
              label={labels.themeLabel}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              value={themePreference}
              onChange={(v) => {
                haptics.select();
                setThemePreference(v);
              }}
              options={[
                {
                  value: 'light',
                  render: (active) => (
                    <Sun
                      size={16}
                      color={active ? (isDark ? '#0B0B0D' : '#0E8C8C') : colors.mutedFg}
                      strokeWidth={2.4}
                    />
                  ),
                },
                {
                  value: 'dark',
                  render: (active) => (
                    <Moon
                      size={16}
                      color={active ? (isDark ? '#0B0B0D' : '#0E8C8C') : colors.mutedFg}
                      strokeWidth={2.4}
                    />
                  ),
                },
                {
                  value: 'system',
                  render: (active) => (
                    <Smartphone
                      size={16}
                      color={active ? (isDark ? '#0B0B0D' : '#0E8C8C') : colors.mutedFg}
                      strokeWidth={2.4}
                    />
                  ),
                },
              ]}
            />
            <SegmentedRow
              label={labels.language}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              value={lang}
              onChange={(v) => {
                if (v === lang) return;
                haptics.select();
                setLang(v as Locale);
              }}
              options={i18n.locales.map((locale) => ({
                value: locale as 'he' | 'en' | 'ru',
                render: (active) => (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: active ? (isDark ? '#0B0B0D' : '#0E8C8C') : colors.mutedFg,
                      letterSpacing: 0.5,
                    }}
                  >
                    {locale.toUpperCase()}
                  </Text>
                ),
              }))}
            />
          </FKGlassPanel>

          <SettingsGroup colors={colors} isRTL={isRTL}>
            <SettingsRow
              Icon={Bell}
              label={labels.settingNotifications}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/notifications')}
            />
          </SettingsGroup>

          {/* Org support — the member's gym */}
          {activeOrganization && (
            <View style={{ gap: 10 }}>
              <SettingsSectionHeader
                title={labels.orgSupportTitle}
                subtitle={labels.orgSupportSubtitle}
                isRTL={isRTL}
                colors={colors}
              />
              <SettingsGroup colors={colors} isRTL={isRTL}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    minHeight: 56,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      overflow: 'hidden',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(40,36,30,0.07)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activeOrganization.logoUrl ? (
                      <Image
                        source={{ uri: activeOrganization.logoUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <Building2 size={16} color={colors.mutedFg} strokeWidth={2} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: colors.foreground,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {activeOrganization.name}
                    </Text>
                  </View>
                </View>

                {orgContactRows.length > 0 && <RowDivider isDark={isDark} />}
                {renderRows(orgContactRows)}
              </SettingsGroup>
            </View>
          )}

          {/* FitKit support — the platform */}
          <View style={{ gap: 10 }}>
            <SettingsSectionHeader
              title={labels.fitkitSupportTitle}
              subtitle={labels.fitkitSupportSubtitle}
              isRTL={isRTL}
              colors={colors}
            />
            <SettingsGroup colors={colors} isRTL={isRTL}>
              {renderRows(fitkitRows)}
            </SettingsGroup>
          </View>

          {/* Privacy & data — analytics opt-out (GDPR withdrawal) */}
          <SettingsGroup colors={colors} isRTL={isRTL}>
            <SettingsRow
              Icon={ShieldCheck}
              label={labels.settingPrivacy}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              iconTint="#0E8C8C"
              onPress={() => router.push('/(tabs)/profile/privacy')}
            />
          </SettingsGroup>

          {/* Danger zone — Delete Account */}
          <SettingsGroup colors={colors} isRTL={isRTL}>
            <SettingsRow
              Icon={Trash2}
              label={labels.settingDeleteAccount}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              tone="destructive"
              onPress={() => router.push('/(tabs)/profile/delete-account')}
            />
          </SettingsGroup>

          {/* Sign out — quiet destructive: rose-500 tinted button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPressIn={haptics.tap}
            onPress={handleSignOut}
            style={{
              marginTop: 4,
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderRadius: 16,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: 'rgba(244,63,94,0.30)',
              backgroundColor: 'rgba(244,63,94,0.10)',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut
              size={16}
              color="#F43F5E"
              strokeWidth={2.4}
              style={{
                marginRight: isRTL ? 0 : 10,
                marginLeft: isRTL ? 10 : 0,
                transform: [{ scaleX: isRTL ? -1 : 1 }],
              }}
            />
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#F43F5E' }}>
              {labels.settingSignOut}
            </Text>
          </TouchableOpacity>

          {/* Footer legal */}
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  haptics.tap();
                  Linking.openURL('https://fitkit.fit/terms-of-use');
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mutedFg }}>
                  {labels.footerTerms}
                </Text>
              </Pressable>
              <Text style={{ fontSize: 10, color: colors.mutedFg }}>•</Text>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  Linking.openURL('https://fitkit.fit/privacy-policy');
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mutedFg }}>
                  {labels.footerPrivacy}
                </Text>
              </Pressable>
            </View>
            <Text
              style={{
                fontSize: 9,
                color: colors.mutedFg,
                fontFamily: 'Assistant-Medium',
              }}
            >
              FitKit v{appVersion}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
