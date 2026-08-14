/**
 * FKEmptyState — the app's one empty-state idiom: a tinted icon tile, a
 * display-weight title, a muted hint, and an optional CTA. Every list
 * screen used to hand-roll this (with drifting tile sizes, hardcoded light
 * teal, and inconsistent gaps); this is the single source.
 */
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from './colors';

export function FKEmptyState({
  Icon,
  title,
  hint,
  action,
  /** `fill` centers inside a flex-1 parent; `inline` hugs its content
   *  (for empty states rendered inside a card/section). */
  layout = 'fill',
}: {
  Icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  layout?: 'fill' | 'inline';
}) {
  const colors = useFKColors();
  // Theme-aware tint of the brand primary (the old hardcoded light-teal
  // rgba never adapted to dark mode's brighter teal).
  const tileBg = colors.isDark
    ? 'rgba(39,200,186,0.12)'
    : 'rgba(14,140,140,0.10)';
  const tileBorder = colors.isDark
    ? 'rgba(39,200,186,0.30)'
    : 'rgba(14,140,140,0.28)';

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 12,
        },
        layout === 'fill' ? { flex: 1 } : { paddingVertical: 28 },
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          borderCurve: 'continuous',
          backgroundColor: tileBg,
          borderWidth: 1,
          borderColor: tileBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={colors.primary} strokeWidth={2.1} />
      </View>
      <Text
        className="font-display"
        style={{
          fontSize: 17,
          fontWeight: '800',
          color: colors.foreground,
          textAlign: 'center',
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedFg,
            textAlign: 'center',
            lineHeight: 18,
            maxWidth: 280,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
    </View>
  );
}
