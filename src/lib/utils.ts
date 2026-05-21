import { clsx, type ClassValue } from 'clsx';
import type { ViewStyle } from 'react-native';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * iOS squircle corner style. Pair with any non-circular borderRadius —
 * `borderCurve: 'continuous'` produces the smoother SF-style corner that
 * UIKit cards / sheets use. Inline it via `style={[continuousCorners, ...]}`.
 */
export const continuousCorners: ViewStyle = { borderCurve: 'continuous' };
