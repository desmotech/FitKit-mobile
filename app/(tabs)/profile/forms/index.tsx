/**
 * My Forms — list of the member's compliance + check-in instances.
 * Reached from Profile → "My Forms" row. Pending instances at the top
 * (the actionable group), then signed/answered, then archived.
 *
 * Tapping a pending compliance row pushes into `/profile/forms/[id]`
 * which reuses the same <FormRenderer> as the public token route, but
 * talks to the authenticated `/forms/instances/:id/submit` endpoint.
 *
 * Empty state nudges members that there's nothing to sign — most days
 * this is the normal state.
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import {
  FKCard,
  FKGlassPanel,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyForms, type MyFormEntry } from '@/hooks/use-forms';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';
const STATUS_PILL_FG: Record<string, string> = {
  pending: '#B84A40',
  sent: '#B84A40',
  scheduled: '#5A6A3F',
  draft: 'rgb(94,112,130)',
  signed: '#0E8C8C',
  answered: '#0E8C8C',
  reviewed: '#0E8C8C',
  archived: 'rgb(94,112,130)',
};

function isActionable(status: string): boolean {
  return status === 'pending' || status === 'sent' || status === 'scheduled';
}

export default function MyFormsScreen() {
  const router = useRouter();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const s = useFormStrings();
  const colors = useFKColors();
  const haptics = useHaptics();
  const bottomPad = useTabBarPadding();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const query = useMyForms(orgId);
  const entries = query.data?.data ?? [];

  // Group: actionable (pending/sent/scheduled) → done (signed/answered/reviewed)
  // → archived. Sort each group by recency.
  const groups = useMemo(() => {
    const actionable: MyFormEntry[] = [];
    const done: MyFormEntry[] = [];
    const archived: MyFormEntry[] = [];
    for (const entry of entries) {
      if (entry.instance.archivedAt) {
        archived.push(entry);
        continue;
      }
      if (isActionable(entry.instance.status)) {
        actionable.push(entry);
      } else {
        done.push(entry);
      }
    }
    const byRecency = (a: MyFormEntry, b: MyFormEntry) =>
      (b.instance.createdAt ?? '').localeCompare(a.instance.createdAt ?? '');
    actionable.sort(byRecency);
    done.sort(byRecency);
    archived.sort(byRecency);
    return { actionable, done, archived };
  }, [entries]);

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return s.statusPending;
      // `sent` only ever belongs to check-ins (compliance statuses are
      // draft/pending/signed/archived), so it reads "time to check in".
      case 'sent':
        return s.statusCheckInDue;
      case 'scheduled':
        return s.statusScheduled;
      case 'signed':
        return s.statusSigned;
      case 'answered':
        return s.statusAnswered;
      case 'reviewed':
        return s.statusReviewed;
      case 'archived':
        return s.statusArchived;
      default:
        return status;
    }
  };

  const onPressEntry = (entry: MyFormEntry) => {
    haptics.tap();
    router.push({
      pathname: '/(tabs)/profile/forms/[instanceId]',
      params: { instanceId: entry.instance.id },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKScreenHeader title={s.listTitle} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomPad,
          gap: 20,
        }}
      >
        {query.isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 84, borderRadius: 16 }} />
            <Skeleton style={{ height: 84, borderRadius: 16 }} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            title={s.emptyTitle}
            subtitle={s.emptySubtitle}
            isRTL={isRTL}
          />
        ) : (
          <>
            {groups.actionable.length > 0 ? (
              <SectionGroup
                header={s.pendingHeader}
                isRTL={isRTL}
                isDark={isDark}
              >
                {groups.actionable.map((entry, idx) => (
                  <Animated.View
                    key={entry.instance.id}
                    entering={FadeInDown.delay(idx * 30).springify().damping(18)}
                  >
                    <FormRow
                      entry={entry}
                      isRTL={isRTL}
                      isDark={isDark}
                      statusLabel={statusLabel(entry.instance.status)}
                      onPress={() => onPressEntry(entry)}
                    />
                  </Animated.View>
                ))}
              </SectionGroup>
            ) : null}

            {groups.done.length > 0 ? (
              <SectionGroup
                header={s.completedHeader}
                isRTL={isRTL}
                isDark={isDark}
              >
                {groups.done.map((entry) => (
                  <FormRow
                    key={entry.instance.id}
                    entry={entry}
                    isRTL={isRTL}
                    isDark={isDark}
                    statusLabel={statusLabel(entry.instance.status)}
                    onPress={() => onPressEntry(entry)}
                  />
                ))}
              </SectionGroup>
            ) : null}

            {groups.archived.length > 0 ? (
              <SectionGroup
                header={s.archivedHeader}
                isRTL={isRTL}
                isDark={isDark}
              >
                {groups.archived.map((entry) => (
                  <FormRow
                    key={entry.instance.id}
                    entry={entry}
                    isRTL={isRTL}
                    isDark={isDark}
                    statusLabel={statusLabel(entry.instance.status)}
                    onPress={() => onPressEntry(entry)}
                  />
                ))}
              </SectionGroup>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionGroup({
  header,
  isRTL,
  isDark,
  children,
}: {
  header: string;
  isRTL: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.5)',
          paddingHorizontal: 4,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {header}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function FormRow({
  entry,
  isRTL,
  isDark,
  statusLabel,
  onPress,
}: {
  entry: MyFormEntry;
  isRTL: boolean;
  isDark: boolean;
  statusLabel: string;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const s = useFormStrings();
  const status = entry.instance.status;
  const isCheckIn = entry.instance.kind === 'check_in';
  const actionable = isActionable(status);
  const pillColor = STATUS_PILL_FG[status] ?? 'rgb(94,112,130)';

  const StatusIcon = actionable
    ? Circle
    : status === 'archived'
      ? ClipboardList
      : status === 'reviewed'
        ? ClipboardCheck
        : CheckCircle2;

  // Actionable rows lead with the kind's idiom: a pen for "sign this"
  // compliance, a clipboard for "fill this out" check-ins.
  const ActionableIcon = isCheckIn ? ClipboardCheck : FileSignature;

  const iconColor = actionable ? '#B84A40' : pillColor;

  const expiresAt = entry.instance.expiresAt;
  let expiresIn: string | null = null;
  if (expiresAt && actionable) {
    const days = Math.max(
      0,
      Math.round(
        (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    if (days <= 30) {
      expiresIn = days <= 1 ? s.expiresToday : s.expiresInDays(days);
    }
  }

  return (
    <FKCard
      style={{
        padding: 0,
        backgroundColor: actionable
          ? isDark
            ? 'rgba(184,74,64,0.10)'
            : 'rgba(184,74,64,0.06)'
          : colors.card,
        borderWidth: actionable ? 1 : 0,
        borderColor: 'rgba(184,74,64,0.25)',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${entry.form.name}, ${statusLabel}`}
        style={{
          minHeight: 72,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: actionable
              ? 'rgba(184,74,64,0.14)'
              : 'rgba(14,140,140,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {actionable ? (
            <ActionableIcon size={20} color={iconColor} strokeWidth={2.2} />
          ) : (
            <StatusIcon size={20} color={iconColor} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {entry.form.name}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: pillColor,
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {statusLabel}
            </Text>
            {expiresIn ? (
              <>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: isDark
                      ? 'rgba(235,235,245,0.4)'
                      : 'rgba(60,60,67,0.4)',
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: isDark
                      ? 'rgba(235,235,245,0.6)'
                      : 'rgba(60,60,67,0.6)',
                  }}
                >
                  {expiresIn}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <ChevronRight
          size={18}
          color={isDark ? 'rgba(235,235,245,0.4)' : 'rgba(60,60,67,0.4)'}
          style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      </Pressable>
    </FKCard>
  );
}

function EmptyState({
  title,
  subtitle,
  isRTL,
}: {
  title: string;
  subtitle: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  return (
    <FKGlassPanel
      radius={20}
      style={{ padding: 28, gap: 12, alignItems: 'center' }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(14,140,140,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FileSignature size={26} color={BRAND_TEAL} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: colors.foreground,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 18,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {subtitle}
      </Text>
    </FKGlassPanel>
  );
}

// `StyleSheet` import retained for the hairline pattern used elsewhere
// but not needed here directly. Strip if lint flags it.
void StyleSheet;
