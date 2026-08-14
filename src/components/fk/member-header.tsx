/**
 * MemberHeader — sticky top bar shared across all member tabs.
 * Mirrors the web's `apps/web/src/app/[lang]/(protected)/(member)/layout.tsx`
 * pattern: org logo + org name on the start edge, actions on the end.
 *
 * One inbox button replaces the old bell + messages pair: every messaging
 * surface (DMs, workout comment threads, announcements) now lives in the
 * unified inbox, so the badge is the server's combined unread total
 * (`GET /organizations/:orgId/badge` — the same number the app icon shows,
 * minus forms).
 *
 * Renders inside a `<SafeAreaView edges={['top']}>` so it respects the
 * device notch / status bar.
 */
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Inbox, QrCode } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrgSwitcher } from '@/components/fk/org-switcher';
import { FKIconButton } from './icon-button';
import { Text } from '@/components/ui/text';
import { useBadgeTotal } from '@/hooks/use-badge';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useInboxStrings } from '@/i18n/use-inbox-strings';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

interface MemberHeaderProps {
  /** Optional QR scan tap handler — when set, renders the QR button. */
  onPressQR?: () => void;
  /** Localized VoiceOver label for the QR button. */
  qrLabel?: string;
  /** Extra trailing slot (renders before the inbox button). */
  trailing?: ReactNode;
}

/**
 * Sticky top chrome shared across every member tab. The header is the
 * mobile analog of a Next.js shared layout: it self-wires its data
 * (active org, unified unread total) and its navigation (inbox button
 * pushes /messages). Tabs render it with **no props** by default;
 * Home opts in to the QR button via `onPressQR`. This is the single
 * source of truth — no per-tab drift.
 */
export function MemberHeader({ onPressQR, qrLabel, trailing }: MemberHeaderProps) {
  const router = useRouter();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const strings = useInboxStrings();

  // Combined unread across DMs + workout comments + announcements.
  const unreadTotal = useBadgeTotal(orgId).data?.data?.count ?? 0;

  const orgName = activeOrganization?.name ?? 'FitKit';
  const orgLogo =
    (activeOrganization as unknown as { logoUrl?: string | null })?.logoUrl ??
    null;
  const orgInitial = (orgName?.[0] ?? 'F').toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        {/* Org identity — becomes a capsule switcher when the user has
            several orgs. The outer view claims the flexible space so the
            switcher hugs its content at the start edge and long org names
            truncate instead of pushing the action buttons out. */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
        <OrgSwitcher>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                borderCurve: 'continuous',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
              }}
            >
              {orgLogo ? (
                <Image
                  source={{ uri: orgLogo }}
                  style={{ width: 32, height: 32 }}
                  contentFit="cover"
                />
              ) : (
                <Text
                  className="font-display"
                  style={{
                    color: colors.isDark ? '#04201E' : '#fff',
                    fontSize: 14,
                    fontWeight: '800',
                  }}
                >
                  {orgInitial}
                </Text>
              )}
            </View>
            <Text
              className="font-display"
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.foreground,
                letterSpacing: -0.2,
                flexShrink: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {orgName}
            </Text>
          </View>
        </OrgSwitcher>
        </View>

        {/* Actions */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {trailing}
          <FKIconButton
            Icon={Inbox}
            label={strings.title}
            onPress={() => {
              haptics.tap();
              router.push('/messages');
            }}
            badge={unreadTotal}
          />
          {onPressQR ? (
            <FKIconButton
              Icon={QrCode}
              variant="primary"
              label={qrLabel ?? 'QR'}
              onPress={() => {
                haptics.tap();
                onPressQR();
              }}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
