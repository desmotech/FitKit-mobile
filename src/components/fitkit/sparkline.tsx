import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { colors } from '@/lib/theme';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Raw hex stroke color; falls back to teal. */
  color?: string;
  strokeWidth?: number;
}

/**
 * Minimal SVG sparkline. Auto-fits to bounds; renders nothing useful if
 * fewer than 2 samples are present (just an empty stub so layout is stable).
 */
export function Sparkline({
  data,
  width = 120,
  height = 28,
  color,
  strokeWidth = 1.5,
}: SparklineProps) {
  const { colorScheme } = useColorScheme();
  const palette = colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const stroke = color ?? palette.primary;

  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const stepX = width / (data.length - 1);
  const path = data
    .map((v, i) => {
      const x = i * stepX;
      // Invert Y so larger values render higher on screen.
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
