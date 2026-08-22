import { View } from 'react-native';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

/**
 * Right-edge brand accent stripe (`fk-card`'s right-side decoration in the
 * new design). 1.5px wide vertical stripe pinned to the start-edge of the
 * card.
 *
 * In RTL the start-edge is on the right; in LTR it's on the left — this
 * mirrors the original mocks (`absolute right-0 top-0 bottom-0 w-1`).
 */
export function FKEdgeStripe({
  tone = 'primary',
  width = 2,
  inset = 0,
}: {
  tone?: 'primary' | 'success' | 'warn' | 'danger' | 'muted';
  width?: number;
  inset?: number;
}) {
  const { dir } = useI18n();
  const rtl = dir === 'rtl';
  const colors = useFKColors();
  const color =
    tone === 'success'
      ? colors.success
      : tone === 'warn'
        ? colors.warning
        : tone === 'danger'
          ? colors.destructive
          : tone === 'muted'
            ? 'rgba(61,90,112,0.6)'
            : colors.primary;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: inset,
        bottom: inset,
        [rtl ? 'right' : 'left']: 0,
        width,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 2,
      }}
    />
  );
}
