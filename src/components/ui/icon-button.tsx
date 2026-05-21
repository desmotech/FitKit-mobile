import { forwardRef } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/use-haptics';

export interface IconButtonProps extends Omit<PressableProps, 'children'> {
  className?: string;
  children: React.ReactNode;
  /** Show a small status dot in the corner. */
  badge?: 'amber' | 'rust' | null;
  /** Squircle (rounded square) vs full circle. */
  shape?: 'squircle' | 'circle';
  /** Glass tint suitable for dark hero backgrounds. */
  glass?: boolean;
}

export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    className,
    children,
    badge,
    shape = 'squircle',
    glass = false,
    onPressIn,
    ...props
  },
  ref,
) {
  const haptics = useHaptics();
  return (
    <Pressable
      ref={ref}
      onPressIn={(e) => {
        haptics.tap();
        onPressIn?.(e);
      }}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      className={cn(
        'w-9 h-9 items-center justify-center border',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        glass
          ? 'bg-white/15 border-white/0'
          : 'bg-muted border-border',
        className,
      )}
      accessibilityRole="button"
      {...props}
    >
      {children}
      {badge ? (
        <View
          className={cn(
            'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full border-[1.5px]',
            badge === 'amber'
              ? 'bg-warning border-primary/80'
              : 'bg-destructive border-primary/80',
          )}
        />
      ) : null}
    </Pressable>
  );
});
