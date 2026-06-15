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
 */
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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
  Sun,
  Trash2,
  Trophy,
  User as UserIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { showActionSheet } from '@/lib/action-sheet';
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
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useMyPersonalRecords,
  useMyStats,
  useMySubscription,
  useRenewSubscription,
} from '@/hooks/use-feed-data';
import { useIncompleteFormsCount } from '@/hooks/use-forms';
import { useHaptics } from '@/hooks/use-haptics';
import { useMediaPermissions } from '@/hooks/use-media-permissions';
import { revokeCurrentDeviceToken } from '@/hooks/use-push-notifications';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { i18n, type Locale } from '@/i18n/config';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useProfileStrings } from '@/i18n/use-profile-strings';
import { queryKeys } from '@/lib/query-keys';
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

export default function ProfileScreen() {
  const router = useRouter();
  const { dir, lang, setLang, t } = useI18n();
  const { user, activeOrganization, isLoading: userLoading } = useCurrentUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { requestCamera, requestLibrary } = useMediaPermissions();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const haptics = useHaptics();
  // `colorScheme` is the *resolved* scheme (used for `isDark` styling);
  // `preference` is the user's persisted choice (light/dark/system) that
  // drives the Theme control.
  const { colorScheme } = useColorScheme();
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemePreference();
  const colors = useFKColors();
  const bottomPad = useTabBarPadding(32);
  const formS = useFormStrings();
  const ps = useProfileStrings();

  const orgId = activeOrganization?.id;
  const incompleteForms = useIncompleteFormsCount(orgId);
  const stats = useMyStats(orgId);
  const prs = useMyPersonalRecords(orgId);
  const subs = useMySubscription(orgId);
  const renew = useRenewSubscription(orgId);
  const queryClient = useQueryClient();

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const profileT = (dict.profile ?? {}) as Record<string, unknown>;
  const settingsT = (profileT.settings ?? {}) as Record<string, string>;
  const valuesT = (profileT.values ?? {}) as Record<string, string>;
  const membershipT = (profileT.membership ?? {}) as Record<string, string>;
  const membershipStatusT =
    ((membershipT as unknown as Record<string, unknown>).status ?? {}) as Record<string, string>;
  const settingsAppT =
    ((dict.settings as Record<string, unknown> | undefined)?.app ?? {}) as
      Record<string, unknown>;
  const themesT = (settingsAppT.themes ?? {}) as Record<string, string>;
  const mobileTabsT = (dict.mobileTabs ?? {}) as Record<string, string>;
  const feedT = (dict.feed ?? {}) as Record<string, unknown>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const contactT = (profileT.contact ?? {}) as Record<string, string>;

  const stat = (k: string, fallback: string) =>
    typeof profileT[k] === 'string' ? (profileT[k] as string) : fallback;

  // Localised stat labels — fall back to English shorts.
  const streakT = (feedT.streak ?? {}) as Record<string, string>;
  const labels = {
    title: mobileTabsT.profile ?? 'Profile',
    workouts: stat('workouts', 'Workouts'),
    prs: stat('newPrs', 'PRs'),
    streak: streakT.label ?? 'Days',
    activeMembership: stat('active', 'Active'),
    thisMonth: stat('classesMonth', 'This Month'),
    newPrsLabel: stat('newPrs', 'New PRs'),
    totalWods: stat('totalClasses', 'Total'),
    memberPrefix: stat('memberSince', 'Member since'),
    membershipTitle: membershipT.title ?? 'Membership',
    noPlan: membershipT.noPlan ?? 'You have no active plan',
    browsePlans: membershipT.browsePlans ?? 'Browse plans',
    expires: membershipT.expires ?? 'Expires {date}',
    renew: membershipT.renew ?? 'Renew',
    renewing: membershipT.renewing ?? 'Renewing…',
    managePlan: valuesT.managePlan ?? 'Manage plan',
    settingPersonal: settingsT.personal ?? 'Personal Details',
    settingPayment: settingsT.payment ?? 'Payments',
    settingHistory: settingsT.history ?? 'Workout History',
    settingGoals: settingsT.goals ?? 'Goals',
    settingPrs: settingsT.prs ?? 'PR Board',
    settingMetrics: settingsT.bodyMetrics ?? 'Body Metrics',
    settingPhotos: settingsT.progressPhotos ?? 'Progress Photos',
    settingForms: settingsT.forms ?? formS.listTitle,
    settingNotifications: settingsT.notifications ?? 'Notifications',
    settingHelp: settingsT.help ?? 'Help & Support',
    settingDangerZone: settingsT.dangerZone ?? 'Account',
    settingSignOut: settingsT.signOut ?? 'Sign Out',
    settingDeleteAccount:
      ((profileT.deleteAccount as Record<string, string> | undefined)?.settingLabel) ??
      'Delete account',
    contactEmail: contactT.email ?? 'Email',
    contactPhone: contactT.phone ?? 'Phone',
    contactWebsite: contactT.website ?? 'Website',
    orgSupportTitle: ps.orgSupportTitle,
    orgSupportSubtitle: ps.orgSupportSubtitle,
    fitkitSupportTitle: ps.fitkitSupportTitle,
    fitkitSupportSubtitle: ps.fitkitSupportSubtitle,
    fitkitFeedback: ps.fitkitFeedback,
    fitkitContact: ps.fitkitContact,
    fitkitWebsite: ps.fitkitWebsite,
    themeLabel: typeof settingsAppT.theme === 'string'
      ? (settingsAppT.theme as string) : 'Theme',
    themeSystem: themesT.system ?? 'System',
    themeLight: themesT.light ?? 'Light',
    themeDark: themesT.dark ?? 'Dark',
    language: stat('language', 'Language'),
    memberSince: 'Member since {year}',
    signOutTitle:
      (profileT.signOutPrompt as string | undefined) ?? 'Sign out?',
    signOutCancel: commonT.cancel ?? 'Cancel',
    signOutConfirm: settingsT.signOut ?? 'Sign Out',
    footerPrivacy:
      ((profileT.footer as Record<string, string> | undefined)?.privacy) ??
      'Privacy',
    footerTerms:
      ((profileT.footer as Record<string, string> | undefined)?.terms) ??
      'Terms',
  };

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || '?';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    '—';
  const classesThisMonth = (stats.data?.data?.classesThisMonth as number) ?? 0;
  const totalClasses = (stats.data?.data?.totalClasses as number) ?? 0;
  const subList = subs.data?.data ?? [];
  const prCount = (prs.data?.data ?? []).length;
  const recentPRRecords = [...(prs.data?.data ?? [])]
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 3);
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';

  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';
  const FITKIT_SUPPORT_EMAIL = 'support@fitkit.fit';
  const FITKIT_WEBSITE = 'https://fitkit.fit';
  const hasOrgContact = Boolean(
    activeOrganization?.contactEmail ||
      activeOrganization?.contactPhone ||
      activeOrganization?.website,
  );

  // "Member since YYYY" — derive from user.createdAt if present, else fall
  // back to the org name. `memberSince` template carries `{year}` for
  // locale-correct word order (Hebrew puts the year *after* the noun).
  const createdYear = (user as unknown as { createdAt?: string })?.createdAt
    ? new Date((user as unknown as { createdAt: string }).createdAt).getFullYear()
    : null;
  const memberSinceTemplate =
    typeof profileT.memberSince === 'string'
      ? (profileT.memberSince as string)
      : labels.memberSince;
  const memberSinceLine = createdYear
    ? memberSinceTemplate.includes('{year}')
      ? memberSinceTemplate.replace('{year}', String(createdYear))
      : `${labels.memberPrefix} ${createdYear}`
    : (activeOrganization?.name ?? 'FitKit');

  const progressPhotosT = (dict.progressPhotos ?? {}) as Record<string, string>;
  const avatarLabels = {
    cancel: commonT.cancel ?? 'Cancel',
    camera: progressPhotosT.fromCamera ?? 'Take photo',
    library: progressPhotosT.fromLibrary ?? 'Choose from library',
    remove: (commonT.remove as string | undefined) ?? 'Remove photo',
    error: (commonT.error as string | undefined) ?? 'Something went wrong',
  };

  // Run a Clerk avatar mutation with a shared busy/haptics/error envelope.
  const applyAvatar = async (run: () => Promise<unknown>) => {
    try {
      setAvatarBusy(true);
      await run();
      await clerkUser?.reload();
      haptics.success();
    } catch (err) {
      haptics.error();
      Alert.alert('', err instanceof Error ? err.message : avatarLabels.error);
    } finally {
      setAvatarBusy(false);
    }
  };

  const setAvatarFromSource = async (source: 'camera' | 'library') => {
    const ok =
      source === 'camera' ? await requestCamera() : await requestLibrary();
    if (!ok) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const a = result.assets[0];
    await applyAvatar(() =>
      clerkUser!.setProfileImage({
        file: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`,
      }),
    );
  };

  const onEditAvatar = () => {
    haptics.tap();
    if (avatarBusy || !clerkUser) return;
    const hasImage = clerkUser.hasImage ?? false;
    const options = hasImage
      ? [avatarLabels.cancel, avatarLabels.camera, avatarLabels.library, avatarLabels.remove]
      : [avatarLabels.cancel, avatarLabels.camera, avatarLabels.library];
    showActionSheet(
      {
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: hasImage ? 3 : undefined,
      },
      (i) => {
        if (i === 1) setAvatarFromSource('camera');
        else if (i === 2) setAvatarFromSource('library');
        else if (i === 3 && hasImage) {
          applyAvatar(() => clerkUser.setProfileImage({ file: null }));
        }
      },
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
          // Clear cached server data so a sign-in as a different user
          // starts with a clean slate.
          try {
            queryClient.clear();
            const AsyncStorage = (
              await import('@react-native-async-storage/async-storage')
            ).default;
            await AsyncStorage.removeItem('fitkit-rq-cache');
          } catch {
            // Cache clear is best-effort — never block sign-out on it.
          }
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);

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
        {/* ── HERO — teal panel, rounded bottom corners */}
        <View
          style={{
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
            {/* teal gradient field */}
            <LinearGradient
              colors={
                colors.isDark
                  ? ['#16776f', '#0f5650', '#0b3f3b']
                  : ['#14a39c', '#0E8C8C', '#0b7474']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* top-trailing sheen */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.25, y: 0.75 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* decorative concentric rings, trailing-bottom */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                insetInlineEnd: -60,
                bottom: -70,
                width: 180,
                height: 180,
                borderRadius: 90,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.16)',
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                insetInlineEnd: -30,
                bottom: -40,
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.16)',
              }}
            />
            <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }}>
              {/* Avatar + name + chips row */}
              <Animated.View
                entering={FadeInDown.duration(420).springify()}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <View style={{ position: 'relative' }}>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 3,
                      borderColor: 'rgba(255,255,255,0.18)',
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.10)',
                    }}
                  >
                    {(clerkUser?.imageUrl ?? user?.imageUrl) ? (
                      <Image
                        source={{ uri: clerkUser?.imageUrl ?? user?.imageUrl ?? undefined }}
                        style={{ width: 80, height: 80 }}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Text
                        className="font-display"
                        style={{
                          color: '#fff',
                          fontSize: 28,
                          lineHeight: 34,
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
                      bottom: -2,
                      [isRTL ? 'right' : 'left']: -2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#0E8C8C',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#1B7C7C',
                    }}
                  >
                    <Pencil size={10} color="#fff" strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  {userLoading ? (
                    <Skeleton style={{ width: 140, height: 24, borderRadius: 6 }} />
                  ) : (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 24,
                        lineHeight: 30,
                        color: '#fff',
                        letterSpacing: -0.6,
                        textAlign: isRTL ? 'right' : 'left',
                        fontFamily: displayFamily(lang, 'bold'),
                      }}
                    >
                      {displayName}
                    </Text>
                  )}
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.78)',
                      fontWeight: '500',
                      marginTop: 2,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {memberSinceLine}
                  </Text>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: 6,
                      marginTop: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: 'rgba(255,255,255,0.18)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#fff',
                          letterSpacing: 0.4,
                        }}
                      >
                        {labels.activeMembership.toUpperCase()}
                      </Text>
                    </View>
                    {/* Flame chip removed — duplicated classesThisMonth from the 3-up grid below. */}
                  </View>
                </View>
              </Animated.View>

              {/* 3-up stat strip — plain numerals on hairline dividers */}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  marginTop: 20,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.20)',
                }}
              >
                <HeroStat
                  value={classesThisMonth}
                  label={labels.thisMonth}
                  lang={lang}
                />
                <View
                  style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.20)' }}
                />
                <HeroStat
                  value={prCount}
                  label={labels.newPrsLabel}
                  lang={lang}
                  accent={colors.isDark ? '#EAC35E' : '#FFE27A'}
                />
                <View
                  style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.20)' }}
                />
                <HeroStat
                  value={totalClasses}
                  label={labels.totalWods}
                  lang={lang}
                />
              </View>
            </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 24 }}>
          {/* ── Recent PRs (scoreboard) ────────────────────────── */}
          {recentPRRecords.length > 0 ? (
            <RecentPRs
              records={recentPRRecords}
              title={stat('personalRecords', 'Personal Records')}
              newLabel={commonT.new ?? 'New'}
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
                  onError: () => haptics.error(),
                });
              }}
            />
          )}

          {/* ── Settings groups ────────────────────────────────── */}
          <SettingsGroup colors={colors} isRTL={isRTL}>
            <SettingsRow
              Icon={UserIcon}
              iconTint={colors.primary}
              label={labels.settingPersonal}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/personal')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={Goal}
              iconTint="#E0552F"
              label={labels.settingGoals}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/goals')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={Trophy}
              iconTint="#B07D2A"
              label={labels.settingPrs}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/prs')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={Scale}
              iconTint="#5E8A4E"
              label={labels.settingMetrics}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/metrics')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={Camera}
              iconTint="#B07D2A"
              label={labels.settingPhotos}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/photos')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={FileSignature}
              iconTint="#C0524A"
              label={labels.settingForms}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              badgeCount={incompleteForms}
              onPress={() => router.push('/(tabs)/profile/forms')}
            />
          </SettingsGroup>

          <SettingsGroup colors={colors} isRTL={isRTL}>
            <SettingsRow
              Icon={History}
              iconTint={colors.primary}
              label={labels.settingHistory}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/history')}
            />
            <RowDivider isDark={isDark} />
            <SettingsRow
              Icon={CreditCard}
              iconTint="#B07D2A"
              label={labels.settingPayment}
              isRTL={isRTL}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push('/(tabs)/profile/payments')}
            />
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

                {hasOrgContact && <RowDivider isDark={isDark} />}

                {activeOrganization?.contactEmail && (
                  <SettingsRow
                    Icon={Mail}
                    label={labels.contactEmail}
                    sublabel={activeOrganization.contactEmail}
                    isRTL={isRTL}
                    colors={colors}
                    isDark={isDark}
                    onPress={() =>
                      Linking.openURL(`mailto:${activeOrganization.contactEmail}`)
                    }
                  />
                )}
                {activeOrganization?.contactPhone && (
                  <>
                    {activeOrganization?.contactEmail && <RowDivider isDark={isDark} />}
                    <SettingsRow
                      Icon={Phone}
                      label={labels.contactPhone}
                      sublabel={activeOrganization.contactPhone}
                      isRTL={isRTL}
                      colors={colors}
                      isDark={isDark}
                      onPress={() =>
                        Linking.openURL(`tel:${activeOrganization.contactPhone}`)
                      }
                    />
                  </>
                )}
                {activeOrganization?.website && (
                  <>
                    {(activeOrganization?.contactEmail ||
                      activeOrganization?.contactPhone) && (
                      <RowDivider isDark={isDark} />
                    )}
                    <SettingsRow
                      Icon={Globe}
                      label={labels.contactWebsite}
                      sublabel={activeOrganization.website}
                      isRTL={isRTL}
                      colors={colors}
                      isDark={isDark}
                      onPress={() =>
                        Linking.openURL(activeOrganization.website ?? '')
                      }
                    />
                  </>
                )}
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
              <SettingsRow
                Icon={MessageSquare}
                label={labels.fitkitFeedback}
                isRTL={isRTL}
                colors={colors}
                isDark={isDark}
                onPress={() => router.push('/(tabs)/profile/feedback')}
              />
              <RowDivider isDark={isDark} />
              <SettingsRow
                Icon={LifeBuoy}
                label={labels.fitkitContact}
                sublabel={FITKIT_SUPPORT_EMAIL}
                isRTL={isRTL}
                colors={colors}
                isDark={isDark}
                onPress={() =>
                  Linking.openURL(
                    `mailto:${FITKIT_SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      `FitKit support — v${appVersion}`,
                    )}`,
                  )
                }
              />
              <RowDivider isDark={isDark} />
              <SettingsRow
                Icon={Globe}
                label={labels.fitkitWebsite}
                sublabel="fitkit.fit"
                isRTL={isRTL}
                colors={colors}
                isDark={isDark}
                onPress={() => Linking.openURL(FITKIT_WEBSITE)}
              />
            </SettingsGroup>
          </View>

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
