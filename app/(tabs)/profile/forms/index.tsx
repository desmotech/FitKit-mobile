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
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSignature,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import {
  FKCard,
  FKGlassPanel,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  useMyForms,
  useOpenSignedFormPdf,
  type MyFormEntry,
} from '@/hooks/use-forms';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Status pill ink, resolved against the active theme's FK tokens. */
function statusPillFg(
  colors: ReturnType<typeof useFKColors>,
): Record<string, string> {
  return {
    pending: colors.destructive,
    sent: colors.destructive,
    scheduled: colors.success,
    draft: colors.info,
    signed: colors.primary,
    answered: colors.primary,
    reviewed: colors.primary,
    archived: colors.info,
  };
}

function isActionable(status: string): boolean {
  return status === 'pending' || status === 'sent' || status === 'scheduled';
}

/**
 * Only a signed compliance instance has a countersigned PDF on file
 * (check-ins never produce one, and a pending form has nothing to show).
 */
function hasSignedPdf(entry: MyFormEntry): boolean {
  return entry.instance.kind === 'compliance' &&
    entry.instance.status === 'signed';
}

/**
 * All versions of "the same form" share (kind, typeKey, planId |
 * planGroupId) — the identity the API versions templates under. Grouping by
 * it collapses re-issues (new version, expiry, recurring check-in) into one
 * card instead of a pile of identically-named rows.
 */
function familyKey(entry: MyFormEntry): string {
  return [
    entry.instance.kind,
    entry.form.typeKey,
    entry.form.planId ?? '',
    entry.form.planGroupId ?? '',
  ].join('|');
}

/** When a completed instance was actually completed, for sorting + display. */
function completedAt(entry: MyFormEntry): string {
  return entry.instance.answeredAt ?? entry.instance.createdAt ?? '';
}

/** One card in the Completed section: the family's latest submission plus
 *  its older ones, collapsed behind a disclosure. */
interface DoneFamily {
  key: string;
  latest: MyFormEntry;
  previous: MyFormEntry[];
}

export default function MyFormsScreen() {
  const router = useRouter();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const s = useFormStrings();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();

  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const query = useMyForms(orgId);
  const entries = useMemo(() => query.data?.data ?? [], [query.data]);

  // Group: actionable (pending/sent/scheduled) → done (signed/answered/
  // reviewed, consolidated per form family) → archived. Sort by recency.
  const groups = useMemo(() => {
    const actionable: MyFormEntry[] = [];
    const archived: MyFormEntry[] = [];
    const doneByFamily = new Map<string, MyFormEntry[]>();
    for (const entry of entries) {
      if (entry.instance.archivedAt) {
        archived.push(entry);
        continue;
      }
      if (isActionable(entry.instance.status)) {
        actionable.push(entry);
        continue;
      }
      const key = familyKey(entry);
      const list = doneByFamily.get(key);
      if (list) list.push(entry);
      else doneByFamily.set(key, [entry]);
    }
    const byRecency = (a: MyFormEntry, b: MyFormEntry) =>
      (b.instance.createdAt ?? '').localeCompare(a.instance.createdAt ?? '');
    actionable.sort(byRecency);
    archived.sort(byRecency);
    const done: DoneFamily[] = [...doneByFamily.entries()].map(
      ([key, list]) => {
        list.sort((a, b) => completedAt(b).localeCompare(completedAt(a)));
        return { key, latest: list[0], previous: list.slice(1) };
      },
    );
    done.sort((a, b) => completedAt(b.latest).localeCompare(completedAt(a.latest)));
    // A pending row whose family was already completed once is a RE-ask —
    // the card says so, which is the answer to "why am I seeing this form
    // again?".
    const latestDoneByFamily = new Map(done.map((g) => [g.key, g.latest]));
    return { actionable, done, archived, latestDoneByFamily };
  }, [entries]);

  const fmtDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString(lang, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

  // Families whose older submissions are expanded.
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleFamily = (key: string) => {
    haptics.tap();
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
      case 'sent':
        return s.statusPending;
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

  // One mutation for the whole list — `variables` names the row whose PDF
  // is in flight, so the spinner and any error land on the right card.
  const pdf = useOpenSignedFormPdf(orgId);

  const pdfProps = (entry: MyFormEntry) => {
    const isThisRow = pdf.variables === entry.instance.id;
    return {
      onDownload: hasSignedPdf(entry)
        ? () => {
            haptics.tap();
            pdf.mutate(entry.instance.id);
          }
        : undefined,
      downloading: isThisRow && pdf.isPending,
      downloadError: isThisRow && pdf.isError ? s.downloadPdfFailed : null,
    };
  };

  const renderRow = (entry: MyFormEntry) => (
    <FormRow
      key={entry.instance.id}
      entry={entry}
      isRTL={isRTL}
      isDark={isDark}
      statusLabel={statusLabel(entry.instance.status)}
      onPress={() => onPressEntry(entry)}
      {...pdfProps(entry)}
    />
  );

  // Pending re-ask of a form the member already completed: name the reason.
  const renderActionableRow = (entry: MyFormEntry) => {
    const prior = groups.latestDoneByFamily.get(familyKey(entry));
    const priorDate =
      prior && entry.instance.kind === 'compliance'
        ? fmtDate(completedAt(prior))
        : null;
    return (
      <FormRow
        key={entry.instance.id}
        entry={entry}
        isRTL={isRTL}
        isDark={isDark}
        statusLabel={statusLabel(entry.instance.status)}
        subtitle={priorDate ? s.replacesSigned(priorDate) : null}
        onPress={() => onPressEntry(entry)}
        {...pdfProps(entry)}
      />
    );
  };

  // One card per family: the latest submission up front (version + date),
  // older submissions behind a disclosure inside the same card.
  const renderDoneFamily = (group: DoneFamily) => {
    const { latest, previous } = group;
    const isCompliance = latest.instance.kind === 'compliance';
    const expiresAt = latest.instance.expiresAt;
    const lapsed =
      isCompliance && expiresAt
        ? new Date(expiresAt).getTime() < Date.now()
        : false;
    const expanded = expandedFamilies.has(group.key);
    return (
      <FormRow
        key={latest.instance.id}
        entry={latest}
        isRTL={isRTL}
        isDark={isDark}
        statusLabel={statusLabel(latest.instance.status)}
        versionLabel={
          isCompliance ? s.versionLabel(latest.instance.formVersion) : null
        }
        dateLabel={fmtDate(completedAt(latest))}
        expiredLabel={
          lapsed && expiresAt ? s.signatureExpired(fmtDate(expiresAt) ?? '') : null
        }
        onPress={() => onPressEntry(latest)}
        {...pdfProps(latest)}
        footer={
          previous.length > 0 ? (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={
                  expanded ? s.hidePrevious : s.showPrevious(previous.length)
                }
                onPress={() => toggleFamily(group.key)}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderTopWidth: 0.5,
                  borderTopColor: isDark
                    ? 'rgba(238,242,246,0.12)'
                    : 'rgba(60,60,67,0.12)',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.primary,
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {expanded ? s.hidePrevious : s.showPrevious(previous.length)}
                </Text>
                {expanded ? (
                  <ChevronUp
                    size={14}
                    color={colors.primary}
                  />
                ) : (
                  <ChevronDown
                    size={14}
                    color={colors.primary}
                  />
                )}
              </Pressable>
              {expanded
                ? previous.map((entry) => (
                    <PreviousRow
                      key={entry.instance.id}
                      entry={entry}
                      isRTL={isRTL}
                      isDark={isDark}
                      versionLabel={
                        entry.instance.kind === 'compliance'
                          ? s.versionLabel(entry.instance.formVersion)
                          : null
                      }
                      dateLabel={fmtDate(completedAt(entry))}
                      onPress={() => onPressEntry(entry)}
                      {...pdfProps(entry)}
                    />
                  ))
                : null}
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <FKSubScreen
      title={s.listTitle}
      contentStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 20 }}
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
                    {renderActionableRow(entry)}
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
                {groups.done.map(renderDoneFamily)}
              </SectionGroup>
            ) : null}

            {groups.archived.length > 0 ? (
              <SectionGroup
                header={s.archivedHeader}
                isRTL={isRTL}
                isDark={isDark}
              >
                {groups.archived.map(renderRow)}
              </SectionGroup>
            ) : null}
          </>
        )}
    </FKSubScreen>
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
          color: isDark ? 'rgba(238,242,246,0.5)' : 'rgba(60,60,67,0.5)',
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
  versionLabel,
  dateLabel,
  expiredLabel,
  subtitle,
  onPress,
  onDownload,
  downloading,
  downloadError,
  footer,
}: {
  entry: MyFormEntry;
  isRTL: boolean;
  isDark: boolean;
  statusLabel: string;
  /** "v3" — which template version this instance is pinned to. */
  versionLabel?: string | null;
  /** When the member completed it. */
  dateLabel?: string | null;
  /** Set when a signed instance's validity window has lapsed. */
  expiredLabel?: string | null;
  /** Secondary explainer line (e.g. why a completed form is asked again). */
  subtitle?: string | null;
  onPress: () => void;
  /** Set only for rows that have a signed PDF to open. */
  onDownload?: () => void;
  downloading?: boolean;
  downloadError?: string | null;
  /** Extra content inside the card, below the main row (older submissions). */
  footer?: React.ReactNode;
}) {
  const colors = useFKColors();
  const s = useFormStrings();
  const status = entry.instance.status;
  const actionable = isActionable(status);
  const pillColor = statusPillFg(colors)[status] ?? colors.info;

  const StatusIcon = actionable
    ? Circle
    : status === 'archived'
      ? ClipboardList
      : status === 'reviewed'
        ? ClipboardCheck
        : CheckCircle2;

  const iconColor = actionable ? colors.destructive : pillColor;

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
      // 0 = expires today; 1 maps to "expires tomorrow" inside expiresInDays.
      expiresIn = days === 0 ? s.expiresToday : s.expiresInDays(days);
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
        accessibilityLabel={[entry.form.name, statusLabel, versionLabel, dateLabel]
          .filter(Boolean)
          .join(', ')}
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
            <FileSignature size={20} color={iconColor} strokeWidth={2.2} />
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
            {entry.instance.kind === 'check_in' ? (
              <>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: isDark
                      ? 'rgba(238,242,246,0.4)'
                      : 'rgba(60,60,67,0.4)',
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.primary,
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {s.kindCheckIn}
                </Text>
              </>
            ) : null}
            {versionLabel ? (
              <>
                <MetaDot isDark={isDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isDark
                      ? 'rgba(238,242,246,0.6)'
                      : 'rgba(60,60,67,0.6)',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {versionLabel}
                </Text>
              </>
            ) : null}
            {dateLabel ? (
              <>
                <MetaDot isDark={isDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: isDark
                      ? 'rgba(238,242,246,0.6)'
                      : 'rgba(60,60,67,0.6)',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {dateLabel}
                </Text>
              </>
            ) : null}
            {expiredLabel ? (
              <>
                <MetaDot isDark={isDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#B84A40',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {expiredLabel}
                </Text>
              </>
            ) : null}
            {expiresIn ? (
              <>
                <MetaDot isDark={isDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: isDark
                      ? 'rgba(238,242,246,0.6)'
                      : 'rgba(60,60,67,0.6)',
                  }}
                >
                  {expiresIn}
                </Text>
              </>
            ) : null}
          </View>
          {subtitle ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {subtitle}
            </Text>
          ) : null}
          {downloadError ? (
            <Text
              accessibilityRole="alert"
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#B84A40',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {downloadError}
            </Text>
          ) : null}
        </View>
        {/* Nested Pressable: the deepest view wins the touch, so tapping
            the PDF button opens the document instead of the form. */}
        {onDownload ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              downloading ? s.downloadPdfPending : s.downloadPdf
            }
            accessibilityState={{ disabled: !!downloading, busy: !!downloading }}
            disabled={downloading}
            hitSlop={8}
            onPress={onDownload}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(14,140,140,0.12)',
            }}
          >
            {downloading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <Download
                size={17}
                color={colors.primary}
                strokeWidth={2.2}
              />
            )}
          </Pressable>
        ) : null}
        {/* Transform must live on a wrapping View, not the icon itself —
            lucide-react-native forwards `style` to every child SVG shape,
            and react-native-svg applies a per-shape transform around the
            viewBox origin (0,0), pushing a mirrored icon off-canvas. */}
        <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
          <ChevronRight
            size={18}
            color={isDark ? 'rgba(238,242,246,0.4)' : 'rgba(60,60,67,0.4)'}
          />
        </View>
      </Pressable>
      {footer}
    </FKCard>
  );
}

/** The tiny dot separating items on a row's meta line. */
function MetaDot({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={{
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: isDark
          ? 'rgba(238,242,246,0.4)'
          : 'rgba(60,60,67,0.4)',
      }}
    />
  );
}

/**
 * A family's older completed submission, revealed by the card's disclosure.
 * Compact: no form name (the card already says it), just version + date,
 * with the same open / download-PDF affordances as the main row.
 */
function PreviousRow({
  entry,
  isRTL,
  isDark,
  versionLabel,
  dateLabel,
  onPress,
  onDownload,
  downloading,
  downloadError,
}: {
  entry: MyFormEntry;
  isRTL: boolean;
  isDark: boolean;
  versionLabel?: string | null;
  dateLabel?: string | null;
  onPress: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  downloadError?: string | null;
}) {
  const s = useFormStrings();
  const colors = useFKColors();
  const mutedFg = isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[entry.form.name, versionLabel, dateLabel]
        .filter(Boolean)
        .join(', ')}
      style={{
        minHeight: 48,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 0.5,
        borderTopColor: isDark
          ? 'rgba(238,242,246,0.12)'
          : 'rgba(60,60,67,0.12)',
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {versionLabel ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: mutedFg,
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {versionLabel}
            </Text>
          ) : null}
          {versionLabel && dateLabel ? <MetaDot isDark={isDark} /> : null}
          {dateLabel ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: mutedFg,
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {dateLabel}
            </Text>
          ) : null}
        </View>
        {downloadError ? (
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 12,
              fontWeight: '500',
              color: '#B84A40',
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {downloadError}
          </Text>
        ) : null}
      </View>
      {onDownload ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={downloading ? s.downloadPdfPending : s.downloadPdf}
          accessibilityState={{ disabled: !!downloading, busy: !!downloading }}
          disabled={downloading}
          hitSlop={8}
          onPress={onDownload}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(14,140,140,0.12)',
          }}
        >
          {downloading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />
          ) : (
            <Download
              size={15}
              color={colors.primary}
              strokeWidth={2.2}
            />
          )}
        </Pressable>
      ) : null}
    </Pressable>
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
        <FileSignature size={26} color={colors.primary} strokeWidth={2.2} />
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

