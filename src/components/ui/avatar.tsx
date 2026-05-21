import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

/**
 * RNR's Avatar primitive (Root/Image/Fallback) re-exported under
 * AvatarRoot/AvatarImage/AvatarFallback. Use these directly when you
 * have an image URL.
 */
function AvatarRoot({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted flex size-full flex-row items-center justify-center rounded-full',
        className
      )}
      {...props}
    />
  );
}

/**
 * FitKit-flavored avatar that draws initials from a person's name.
 * Per the design bundle: primary/12 background, primary text, ~36%
 * font-size of the avatar diameter, no image.
 */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (
    parts
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

interface AvatarProps {
  name?: string | null;
  size?: number;
  /** When provided, renders the photo via expo-image. Falls back to initials. */
  imageUrl?: string | null;
  className?: string;
}

function Avatar({ name, size = 36, imageUrl, className }: AvatarProps) {
  const fontSize = Math.round(size * 0.36);
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full bg-primary/12 overflow-hidden',
        className
      )}
      style={{ width: size, height: size, borderCurve: 'continuous' }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text
          className="font-display font-bold text-primary"
          style={{ fontSize, lineHeight: fontSize * 1.1 }}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

export { Avatar, AvatarRoot, AvatarImage, AvatarFallback };
export type { AvatarProps };
