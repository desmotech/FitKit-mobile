// Finger-drawn signature canvas. Captured to PNG via view-shot (captureRef),
// not Svg.toDataURL (which never fires on Fabric). Value is a local file URI;
// FormRenderer uploads it and swaps in { r2Key, mime } before submit.
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Eraser, PenLine } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Image as ExpoImage } from 'expo-image';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useFormStrings } from '@/i18n/use-form-strings';
import type { FormField } from '@/types/forms';
import { useFormRTL } from '../form-rtl-context';
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

export interface SignatureFieldProps {
  field: Extract<FormField, { type: 'signature' }>;
  /**
   * Local file URI of the rendered PNG. <FormRenderer> swaps this for
   * a `{ r2Key, mime: 'image/png' }` value before POSTing the form.
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
  const isRTL = useFormRTL();
  const s = useFormStrings();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedFg = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';

  const [editing, setEditing] = useState(!value);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>([]);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const canvasSize = useRef({ width: 0, height: 200 });
  const shotRef = useRef<View | null>(null);

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
    setCommitError(null);
    liveStroke.current = [];
  };

  const onCommit = async () => {
    if (strokes.length === 0 || !shotRef.current) return;
    if (committing) return;
    setCommitError(null);
    setCommitting(true);
    try {
      const width = Math.max(1, Math.round(canvasSize.current.width));
      const height = Math.max(1, Math.round(canvasSize.current.height));

      if (width < 10 || height < 10) {
        throw new Error('Canvas not laid out yet — try again.');
      }

      // Timeout guard so a wedged native call never hangs "Save".
      const fileUri: string = await Promise.race([
        captureRef(shotRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width,
          height,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error('Signature capture timed out.')),
            5000,
          ),
        ),
      ]);

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || !info.size || info.size < 100) {
        throw new Error('Signature file was not saved correctly.');
      }

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[signature] saved', { fileUri, size: info.size });
      }

      haptics.success();
      onChange(fileUri);
      setEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.';
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[signature] commit failed:', message, err);
      }
      haptics.error();
      setCommitError(message);
    } finally {
      setCommitting(false);
    }
  };

  const onResign = () => {
    haptics.tap();
    setStrokes([]);
    setCurrent([]);
    setCommitError(null);
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
      helpText={field.helpText ?? (editing ? s.sigHint : undefined)}
      error={commitError ?? error}
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
            <View
              ref={shotRef}
              collapsable={false}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              <Svg
                width="100%"
                height="100%"
                style={StyleSheet.absoluteFill}
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
            </View>
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
                  {s.sigPlaceholder}
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
                accessibilityLabel={s.sigClear}
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
                  {s.sigClear}
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
                accessibilityLabel={s.sigSave}
                onPress={() => {
                  void onCommit();
                }}
                disabled={strokes.length === 0 || committing}
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
                  {committing ? '…' : s.sigSave}
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
            <ExpoImage
              source={{ uri: value }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: isDark ? '#fff' : '#0D1B2A',
              }}
            >
              {s.sigSigned}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.sigResign}
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
                {s.sigResign}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </FieldShell>
  );
}
