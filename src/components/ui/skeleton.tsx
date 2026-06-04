import { cn } from '@/lib/utils';
import { View } from 'react-native';

function Skeleton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      {...props}
      className={cn('bg-muted animate-pulse rounded-md', className)}
      style={[{ borderCurve: 'continuous' as const }, style as object]}
    />
  );
}

export { Skeleton };
