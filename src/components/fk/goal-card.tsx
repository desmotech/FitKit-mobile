/**
 * GoalCard — shared between Goals index (full) and Home dashboard (compact).
 *
 * Layout (per the design system): a progress Ring leading, then name +
 * "current → target" sub-line, then a trailing slot.
 *
 * Variants
 *   `full` — Ring + name + value + edit/trash icons.
 *            Used inside /profile/goals/index.tsx.
 *   `compact` — Ring + name + value with a tap-to-open chevron, used on Home
 *            where the card pushes to the goal detail screen.
 *   Achieved goals swap the Ring for a green check and show an "Achieved" stamp.
 */
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { GoalResponse } from '@fitkit/shared';
import { Text } from '@/components/ui/text';
import { font } from '@/lib/type';
import { useFKColors } from './colors';
import { FKGlassPanel } from './glass-panel';
import { FKRing } from './ring';

export type GoalCardVariant = 'full' | 'compact';

export interface GoalCardLabels {
  bodyMetric: string;
  exercisePr: string;
  achieved: string;
  deadline: string;
  noData: string;
}

export interface GoalCardProps {
  goal: GoalResponse;
  isRTL: boolean;
  labels: GoalCardLabels;
  /** Body-metric type → human label dictionary (e.g. `{ weight: 'Weight' }`). */
  bmTypes: Record<string, string>;
  variant?: GoalCardVariant;
  /** Tap handler. Compact variant always uses this; full variant uses the
   *  pencil icon as the explicit edit trigger and leaves the card surface
   *  passive. */
  onPress?: () => void;
  /** Edit + archive shown only on `full` variant. */
  onEdit?: () => void;
  onArchive?: () => void;
}

export function GoalCard({
  goal,
  isRTL,
  labels,
  bmTypes,
  variant = 'full',
  onPress,
  onEdit,
  onArchive,
}: GoalCardProps) {
  const colors = useFKColors();
  const isCompact = variant === 'compact';
  const isBodyMetric = goal.type === 'body_metric';
  const isAchieved = goal.status === 'achieved';
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const name = isBodyMetric
    ? bmTypes[goal.metricType ?? ''] ?? goal.metricType ?? '—'
    : goal.exerciseName ?? '—';
  const isTimeUnit = goal.unit === 'mm:ss' || goal.unit === 'seconds';
  const unitLabel = isTimeUnit ? '' : ` ${goal.unit}`;
  const pct = Math.min(Math.max(goal.progressPercent ?? 0, 0), 100);
  // "current → target" value line (numerals + Latin unit → mono scoreboard).
  const sub =
    goal.currentValue != null
      ? `${goal.currentValue} → ${goal.targetValue}${unitLabel}`
      : `→ ${goal.targetValue}${unitLabel}`;

  const tintBg = isAchieved
    ? 'rgba(122,138,92,0.16)'
    : 'rgba(14,140,140,0.10)';
  const tintBorder = isAchieved
    ? 'rgba(122,138,92,0.30)'
    : 'rgba(14,140,140,0.30)';
  const tintFg = isAchieved ? '#5A6A3F' : '#0E8C8C';

  const inner = (
    <FKGlassPanel
      radius={18}
      style={{
        padding: isCompact ? 14 : 16,
        gap: isCompact ? 10 : 12,
        ...(isAchieved
          ? {
              backgroundColor: 'rgba(122,138,92,0.06)',
              borderColor: 'rgba(122,138,92,0.30)',
            }
          : null),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {isAchieved ? (
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: tintBg,
              borderWidth: 1,
              borderColor: tintBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={22} color={tintFg} strokeWidth={2.6} />
          </View>
        ) : (
          <FKRing
            pct={pct}
            size={46}
            sw={4}
            // Body-metric goals read in warm red; exercise PRs in brand teal.
            color={isBodyMetric ? '#E0552F' : colors.primary}
            track={colors.border}
          />
        )}
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14.5,
              fontWeight: '800',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11.5,
              color: colors.mutedFg,
              marginTop: 3,
              fontFamily: font.mono,
              writingDirection: 'ltr',
            }}
          >
            {sub}
          </Text>
        </View>

        {/* Trailing slot:
              - achieved badge (any variant)
              - compact → chevron
              - full → edit + archive icons */}
        {isAchieved ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: tintBg,
              borderWidth: 1,
              borderColor: tintBorder,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: tintFg,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {labels.achieved}
            </Text>
          </View>
        ) : isCompact ? (
          <Chevron
            size={18}
            color="rgba(94,112,130,0.55)"
            strokeWidth={2.2}
          />
        ) : (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {onEdit ? (
              <IconButton onPress={onEdit} colors={colors}>
                <Pencil size={15} color={colors.mutedFg} strokeWidth={2.2} />
              </IconButton>
            ) : null}
            {onArchive ? (
              <IconButton onPress={onArchive} colors={colors}>
                <Trash2 size={15} color={colors.mutedFg} strokeWidth={2.2} />
              </IconButton>
            ) : null}
          </View>
        )}
      </View>
    </FKGlassPanel>
  );

  // Compact variant wraps the whole card in a Pressable so the entire
  // surface taps through. Full variant leaves the card passive — only the
  // explicit pencil triggers edit.
  if (isCompact && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={name}
      >
        {({ pressed }) => (
          <View style={{ opacity: pressed ? 0.85 : 1 }}>{inner}</View>
        )}
      </Pressable>
    );
  }
  return inner;
}

/**
 * Bordered square action button (edit / archive). The visuals live on an
 * inner View — a Pressable `style` function returning an array drops the
 * base style on first render in this RN setup, which would strip the
 * border + fill and leave a naked icon.
 */
function IconButton({
  onPress,
  colors,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  colors: ReturnType<typeof useFKColors>;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(255,255,255,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
          }}
        >
          {children}
        </View>
      )}
    </Pressable>
  );
}
