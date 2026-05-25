/**
 * `signature` form field — finger-drawn signature canvas.
 *
 * Implementation: SVG `<Path>` per stroke, captured via PanResponder.
 * No new dep needed; react-native-svg 15.x is already in the bundle.
 *
 * The captured strokes are rendered into a PNG-ish data URL on commit
 * (currently we emit a serialised SVG string as the local value). The
 * R2 upload + r2Key swap is deferred to FIT-189 (API gap).
 *
 * UX:
 *   - Tap "Sign" to expand into a dedicated 200pt canvas
 *   - "Clear" wipes the strokes
 *   - The committed signature shows as a 96pt preview tile with a
 *     "Re-sign" affordance underneath
 */
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Eraser, PenLine } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import type { FormField } from '@/types/forms';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';

type Point = { x: number; y: number };
type Stroke = Point[];

function strokeToPath(stroke: Stroke): string {
  if (stroke.length === 0) return '';
  if (stroke.length === 1) {
    const { x, y } = stroke[0];
    return `M${x.toFixed(2)} ${y.toFixed(2)} L${x.toFixed(2)} ${(y + 0.1).toFixed(2)}`;
  }
  const [first, ...rest] = stroke;
  let d = `M${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  for (const p of rest) {
    d += ` L${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

function serialiseSvg(strokes: Stroke[], width: number, height: number): string {
  const paths = strokes
    .map(
      (s) =>
        `<path d="${strokeToPath(s)}" stroke="#0D1B2A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
}

export interface SignatureFieldProps {
  field: Extract<FormField, { type: 'signature' }>;
  /**
   * Local serialised SVG markup (set on commit). The real r2Key
   * substitution happens at submit time once FIT-189 lands.
   */
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}

export function SignatureFieldRenderer({
  field,
  value,
  onChange,
  error,
}: SignatureFieldProps) {
  const haptics = useHaptics();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedFg = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';

  const [editing, setEditing] = useState(!value);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>([]);
  const canvasSize = useRef({ width: 0, height: 200 });

  // PanResponder lives across renders to avoid re-creation on every
  // stroke update; it reads/writes the live stroke buffer via refs.
  const liveStroke = useRef<Stroke>([]);
  const pan = useRef<PanResponderInstance | null>(null);
  if (!pan.current) {
    pan.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        liveStroke.current = [{ x: locationX, y: locationY }];
        setCurrent(liveStroke.current);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const last = liveStroke.current[liveStroke.current.length - 1];
        // Drop redundant points within 1pt — the SVG stays small without
        // visible loss of fidelity.
        if (
          last &&
          Math.abs(last.x - locationX) < 1 &&
          Math.abs(last.y - locationY) < 1
        ) {
          return;
        }
        liveStroke.current = [
          ...liveStroke.current,
          { x: locationX, y: locationY },
        ];
        setCurrent(liveStroke.current);
      },
      onPanResponderRelease: () => {
        if (liveStroke.current.length === 0) return;
        setStrokes((prev) => [...prev, liveStroke.current]);
        liveStroke.current = [];
        setCurrent([]);
      },
    });
  }

  const onClear = () => {
    haptics.select();
    setStrokes([]);
    setCurrent([]);
    liveStroke.current = [];
  };

  const onCommit = () => {
    if (strokes.length === 0) return;
    haptics.success();
    const svg = serialiseSvg(
      strokes,
      canvasSize.current.width,
      canvasSize.current.height,
    );
    onChange(svg);
    setEditing(false);
  };

  const onResign = () => {
    haptics.tap();
    setStrokes([]);
    setCurrent([]);
    liveStroke.current = [];
    setEditing(true);
  };

  const canvasBg = isDark
    ? 'rgba(118,118,128,0.20)'
    : 'rgba(118,118,128,0.10)';
  const canvasBorder = 'rgba(94,112,130,0.25)';

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={
        field.helpText ??
        (editing ? 'Sign using your finger inside the box.' : undefined)
      }
      error={error}
    >
      {editing ? (
        <View style={{ gap: 8 }}>
          <View
            onLayout={(e) => {
              canvasSize.current = {
                width: e.nativeEvent.layout.width,
                height: 200,
              };
            }}
            style={{
              width: '100%',
              height: 200,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: canvasBorder,
              backgroundColor: canvasBg,
              overflow: 'hidden',
              position: 'relative',
            }}
            {...pan.current.panHandlers}
          >
            <Svg
              width="100%"
              height="100%"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              {strokes.map((s, idx) => (
                <Path
                  key={idx}
                  d={strokeToPath(s)}
                  stroke="#0D1B2A"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {current.length > 0 ? (
                <Path
                  d={strokeToPath(current)}
                  stroke="#0D1B2A"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </Svg>
            {strokes.length === 0 && current.length === 0 ? (
              <View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PenLine size={28} color={mutedFg} strokeWidth={1.5} />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: mutedFg,
                  }}
                >
                  Sign here
                </Text>
              </View>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <View
              style={{
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: canvasBorder,
                overflow: 'hidden',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear signature"
                onPress={onClear}
                disabled={strokes.length === 0 && current.length === 0}
                style={{
                  flex: 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity:
                    strokes.length === 0 && current.length === 0 ? 0.4 : 1,
                }}
              >
                <Eraser size={14} color={mutedFg} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: mutedFg,
                  }}
                >
                  Clear
                </Text>
              </Pressable>
            </View>
            <View
              style={{
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor:
                  strokes.length === 0
                    ? 'rgba(14,140,140,0.30)'
                    : BRAND_TEAL,
                overflow: 'hidden',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save signature"
                onPress={onCommit}
                disabled={strokes.length === 0}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#fff',
                  }}
                >
                  Save signature
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 120,
              height: 64,
              borderRadius: 10,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: canvasBorder,
              backgroundColor: '#fff',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SignaturePreview svg={value} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: isDark ? '#fff' : '#0D1B2A',
              }}
            >
              Signed
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Re-sign"
              onPress={onResign}
              hitSlop={6}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: BRAND_TEAL,
                }}
              >
                Re-sign
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </FieldShell>
  );
}

/**
 * Renders a tiny preview of the captured strokes inside the committed
 * tile. Re-parses the SVG path data we serialised at commit time.
 */
function SignaturePreview({ svg }: { svg: string }) {
  // Cheap regex-based extraction — we control the format on the way in,
  // so a strict parser is overkill.
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  const width = widthMatch ? parseFloat(widthMatch[1]) : 100;
  const height = heightMatch ? parseFloat(heightMatch[1]) : 200;
  const paths = Array.from(svg.matchAll(/<path d="([^"]+)"/g)).map(
    (m) => m[1],
  );
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {paths.map((d, idx) => (
        <Path
          key={idx}
          d={d}
          stroke="#0D1B2A"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
