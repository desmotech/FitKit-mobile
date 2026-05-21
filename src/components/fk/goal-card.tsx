/**
 * GoalCard — shared between Goals index (full) and Home dashboard (compact).
 *
 * Variants
 *   `full` — icon + name + type kicker + edit/trash icons + progress bar.
 *            Used inside /profile/goals/index.tsx.
 *   `compact` — same icon + name + progress bar but no row actions and a
 *            tap-to-open chevron, used on Home where the card pushes to
 *            the goal detail screen instead of inline editing.
 */
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Pencil,
  Target,
  Trash2,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { GoalResponse } from '@fitkit/shared';
import { Text } from '@/components/ui/text';
import { FKGlassPanel, useFKColors } from './index';

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
  const Icon = isAchieved ? CheckCircle2 : isBodyMetric ? Target : Dumbbell;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const name = isBodyMetric
    ? bmTypes[goal.metricType ?? ''] ?? goal.metricType ?? '—'
    : goal.exerciseName ?? '—';
  const isTimeUnit = goal.unit === 'mm:ss' || goal.unit === 'seconds';
  const unitLabel = isTimeUnit ? '' : ` ${goal.unit}`;
  const pct = Math.min(Math.max(goal.progressPercent ?? 0, 0), 100);

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
        <View
          style={{
            width: isCompact ? 36 : 40,
            height: isCompact ? 36 : 40,
            borderRadius: 12,
            backgroundColor: tintBg,
            borderWidth: 1,
            borderColor: tintBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={isCompact ? 16 : 18} color={tintFg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: colors.mutedFg,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            {isBodyMetric ? labels.bodyMetric : labels.exercisePr}
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
              gap: 2,
            }}
          >
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && { opacity: 0.5 },
                ]}
              >
                <Pencil size={14} color={colors.mutedFg} strokeWidth={2.2} />
              </Pressable>
            ) : null}
            {onArchive ? (
              <Pressable
                onPress={onArchive}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && { opacity: 0.5 },
                ]}
              >
                <Trash2 size={15} color="#B84A40" strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: colors.mutedFg,
              fontFamily: 'DMMono',
            }}
          >
            {goal.currentValue != null
              ? `${goal.currentValue}${unitLabel}`
              : labels.noData}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: colors.foreground,
              fontFamily: 'DMMono',
            }}
          >
            {goal.targetValue}
            {unitLabel}
          </Text>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: colors.muted,
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${pct}%`,
              backgroundColor: tintFg,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            marginTop: 2,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: colors.mutedFg,
              fontVariant: ['tabular-nums'],
            }}
          >
            {pct.toFixed(0)}%
          </Text>
          {goal.deadline ? (
            <Text style={{ fontSize: 10, color: colors.mutedFg }}>
              {labels.deadline}: {new Date(goal.deadline).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
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
