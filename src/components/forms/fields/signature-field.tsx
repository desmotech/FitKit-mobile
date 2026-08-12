// Finger-drawn signature canvas. Captured to PNG via view-shot (captureRef),
// not Svg.toDataURL (which never fires on Fabric). Value is a local file URI;
// FormRenderer uploads it and swaps in { r2Key, mime } before submit.
//
// Touch capture uses react-native-gesture-handler, NOT the legacy
// PanResponder. The responder system negotiates with ancestors: the two
// screen-level scrollers could steal the touch mid-stroke (default
// onPanResponderTerminationRequest → true), which silently dropped the
// in-flight stroke — the user saw ink, but Save stayed disabled and the
// screen scrolled under their finger. An RNGH Pan with minDistance(0)
// claims the touch on contact, so parent scrolling never competes, and
// onFinalize commits the stroke buffer even if the gesture is interrupted.
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Eraser, PenLine } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Image as ExpoImage } from 'expo-image';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useFormStrings } from '@/i18n/use-form-strings';
import { reportHandledError } from '@/lib/error-reporting';
import type { FormField } from '@/types/forms';
import { useFormRTL } from '../form-rtl-context';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';
const INK = '#0D1B2A';
// The canvas is always white regardless of theme: the captured PNG is
// embedded in the legal PDF, so it must be opaque (view-shot preserves
// alpha) and readable on any background — paper, not glass.
const CANVAS_BG = '#FFFFFF';
const PLACEHOLDER_FG = 'rgba(60,60,67,0.45)';

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
  /**
   * The answer is already an uploaded `{ r2Key }` (retry after a failed
   * submit, or a server-prefilled answer). Signed, but with no local
   * file to preview.
   */
  uploaded?: boolean;
  onChange: (next: string) => void;
  error?: string | null;
}

export function SignatureFieldRenderer({
  field,
  value,
  uploaded,
  onChange,
  error,
}: SignatureFieldProps) {
  const haptics = useHaptics();
  const isRTL = useFormRTL();
  const s = useFormStrings();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedFg = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';

  const [editing, setEditing] = useState(!value && !uploaded);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>([]);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const canvasSize = useRef({ width: 0, height: 200 });
  const shotRef = useRef<View | null>(null);
  const liveStroke = useRef<Stroke>([]);

  const hasInk = strokes.length > 0 || current.length > 0;

  const beginStroke = (x: number, y: number) => {
    setCommitError(null);
    liveStroke.current = [{ x, y }];
    setCurrent(liveStroke.current);
  };

  const extendStroke = (x: number, y: number) => {
    const last = liveStroke.current[liveStroke.current.length - 1];
    // Drop redundant points within 1pt — the SVG stays small without
    // visible loss of fidelity.
    if (last && Math.abs(last.x - x) < 1 && Math.abs(last.y - y) < 1) {
      return;
    }
    liveStroke.current = [...liveStroke.current, { x, y }];
    setCurrent(liveStroke.current);
  };

  // Called from onFinalize, which RNGH fires on BOTH completion and
  // interruption — ink is committed to `strokes` no matter how the
  // gesture ends. The old PanResponder only committed on a clean
  // release, so a stolen touch dropped the whole stroke.
  const endStroke = () => {
    if (liveStroke.current.length === 0) return;
    const done = liveStroke.current;
    liveStroke.current = [];
    setStrokes((prev) => [...prev, done]);
    setCurrent([]);
  };

  // minDistance(0): activate on contact so the parent scrollers (which
  // need ~10pt of travel) never win the touch. onBegin (not onStart)
  // starts the stroke so a plain tap still leaves a dot.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onBegin((e) => beginStroke(e.x, e.y))
        .onUpdate((e) => extendStroke(e.x, e.y))
        .onFinalize(() => endStroke()),
    // Handlers only touch refs and functional setState — safe to build once.
    [],
  );

  const onClear = () => {
    haptics.select();
    setStrokes([]);
    setCurrent([]);
    setCommitError(null);
    liveStroke.current = [];
    // Drop any previously saved answer too — otherwise a cleared canvas
    // still submits the stale PNG sitting in FormRenderer's answers
    // (or the r2Key of an already-uploaded one).
    if (value || uploaded) onChange('');
  };

  const onCommit = async () => {
    if (!hasInk || !shotRef.current) return;
    if (committing) return;
    setCommitError(null);
    setCommitting(true);
    try {
      const width = Math.round(canvasSize.current.width);
      const height = Math.round(canvasSize.current.height);
      if (width < 10 || height < 10) {
        throw new Error(s.sigErrNotReady);
      }

      // No width/height override: view-shot then captures at the device
      // pixel ratio instead of downscaling to points — the PDF gets a
      // sharp signature, not a ~350px blur.
      const captured: string = await Promise.race([
        captureRef(shotRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(s.sigErrTimeout)), 5000),
        ),
      ]);

      // captureRef returns a bare path on iOS; FormRenderer's upload only
      // fires for file:// URIs, so normalise the scheme.
      const fileUri = captured.includes('://')
        ? captured
        : `file://${captured}`;

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || !info.size || info.size < 100) {
        throw new Error(s.sigErrBadFile);
      }

      if (__DEV__) {
        console.log('[signature] saved', { fileUri, size: info.size });
      }

      haptics.success();
      onChange(fileUri);
      setEditing(false);
    } catch (err) {
      // Was DEV-console only: a member who cannot sign is fully blocked, and
      // in production nothing recorded why.
      reportHandledError(err, { feature: 'signature-commit' });
      // Localized copy only — the raw failure is a canvas/encode error.
      const message = s.sigErrSaveFailed;
      if (__DEV__) {
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
    // The saved URI must not survive into a re-sign session — clearing
    // it also flips the field back to "unanswered" for validation.
    if (value || uploaded) onChange('');
    setEditing(true);
  };

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
          <GestureDetector gesture={panGesture}>
            <View
              accessible
              accessibilityLabel={field.label}
              accessibilityHint={s.sigHint}
              onLayout={(e) => {
                canvasSize.current = {
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                };
              }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: canvasBorder,
                backgroundColor: CANVAS_BG,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <View
                ref={shotRef}
                collapsable={false}
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: CANVAS_BG }]}
              >
                <Svg
                  width="100%"
                  height="100%"
                  style={StyleSheet.absoluteFill}
                >
                  {strokes.map((stroke, idx) => (
                    <Path
                      key={idx}
                      d={strokeToPath(stroke)}
                      stroke={INK}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {current.length > 0 ? (
                    <Path
                      d={strokeToPath(current)}
                      stroke={INK}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ) : null}
                </Svg>
              </View>
              {!hasInk ? (
                <View
                  pointerEvents="none"
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PenLine size={28} color={PLACEHOLDER_FG} strokeWidth={1.5} />
                  <Text
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: PLACEHOLDER_FG,
                    }}
                  >
                    {s.sigPlaceholder}
                  </Text>
                </View>
              ) : null}
            </View>
          </GestureDetector>
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
                height: 44,
                paddingHorizontal: 14,
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
                accessibilityState={{ disabled: !hasInk }}
                onPress={onClear}
                disabled={!hasInk}
                style={{
                  flex: 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: hasInk ? 1 : 0.4,
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
                height: 44,
                paddingHorizontal: 18,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: hasInk ? BRAND_TEAL : 'rgba(14,140,140,0.30)',
                overflow: 'hidden',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.sigSave}
                accessibilityState={{ disabled: !hasInk || committing }}
                onPress={() => {
                  void onCommit();
                }}
                disabled={!hasInk || committing}
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
            {value ? (
              <ExpoImage
                source={{ uri: value }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            ) : (
              // Already uploaded — the PNG lives in R2, not on disk.
              <PenLine size={22} color={PLACEHOLDER_FG} strokeWidth={1.8} />
            )}
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
