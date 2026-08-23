import {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import { View, type ViewStyle } from 'react-native';

/**
 * Brand mark — the Taikan logo, drawn as vector rather than shipped as a PNG.
 *
 * Vector matters here beyond file size: the tab bar renders it at 20px and the
 * splash overlay at 160px from the same source, and one raster can't be crisp
 * at both. Geometry and the ramp are transcribed from the brand kit (v3.1);
 * the canonical SVGs live in assets/brand/ in the main repo.
 */

/** One closed outline: two crossbars, four returns, and the tapered core. */
const MARK_PATH =
  'M0 1.2 Q0 0 1.2 0 H22.8 Q24 0 24 1.2 V8.5 C24 10.6 20 10.6 20 8.5 V5.5 ' +
  'Q20 4.5 19 4.5 H17.5 Q16.5 4.5 16.05 5.6 L15.05 11.2 Q14.75 12 15.05 12.8 ' +
  'L16.05 18.4 Q16.5 19.5 17.5 19.5 H19 Q20 19.5 20 18.5 V15.5 C20 13.4 24 13.4 24 15.5 ' +
  'V22.8 Q24 24 22.8 24 H1.2 Q0 24 0 22.8 V15.5 C0 13.4 4 13.4 4 15.5 V18.5 ' +
  'Q4 19.5 5 19.5 H6.5 Q7.5 19.5 7.95 18.4 L8.95 12.8 Q9.25 12 8.95 11.2 ' +
  'L7.95 5.6 Q7.5 4.5 6.5 4.5 H5 Q4 4.5 4 5.5 V8.5 C4 10.6 0 10.6 0 8.5 Z';

/** The tapered core, drawn as an overlay on the flat fallback. */
const CORE_PATH =
  'M6.5 4.5 H17.5 Q16.5 4.5 16.05 5.6 L15.05 11.2 Q14.75 12 15.05 12.8 ' +
  'L16.05 18.4 Q16.5 19.5 17.5 19.5 H6.5 Q7.5 19.5 7.95 18.4 L8.95 12.8 ' +
  'Q9.25 12 8.95 11.2 L7.95 5.6 Q7.5 4.5 6.5 4.5 Z';

/** Below this the fillets and shading bands are sub-pixel — use the flat file. */
const FLAT_THRESHOLD = 32;

export type FKBrandMarkVariant = 'auto' | 'gradient' | 'flat' | 'mono';

export function FKBrandMark({
  size = 32,
  variant = 'auto',
  color,
  coreColor,
  style,
}: {
  size?: number;
  variant?: FKBrandMarkVariant;
  /** Frame colour for the `flat` and `mono` variants. */
  color?: string;
  /** Core colour for the `flat` variant. */
  coreColor?: string;
  style?: ViewStyle;
}) {
  const resolved =
    variant === 'auto' ? (size < FLAT_THRESHOLD ? 'flat' : 'gradient') : variant;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {resolved === 'gradient' ? (
          <>
            <Defs>
              {/* Vertical only. A diagonal ramp breaks the mark's left-right
                  mirror, which is what lets the RTL lockup reuse this file. */}
              <LinearGradient id="tkRamp" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#3FE0DC" />
                <Stop offset="0.16" stopColor="#2AB8B8" />
                <Stop offset="0.5" stopColor="#3E8FD0" />
                <Stop offset="0.82" stopColor="#8A5CF0" />
                <Stop offset="1" stopColor="#6C43D8" />
              </LinearGradient>
              <LinearGradient id="tkAo1" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#07202B" stopOpacity="0.42" />
                <Stop offset="1" stopColor="#07202B" stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="tkAo2" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#07202B" stopOpacity="0" />
                <Stop offset="1" stopColor="#07202B" stopOpacity="0.3" />
              </LinearGradient>
              <LinearGradient id="tkHi" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#EAFBFA" stopOpacity="0.42" />
                <Stop offset="1" stopColor="#EAFBFA" stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="tkCatch" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#AE92FF" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#AE92FF" stopOpacity="0" />
              </LinearGradient>
              <ClipPath id="tkClip">
                <Path d={MARK_PATH} />
              </ClipPath>
            </Defs>
            <Path d={MARK_PATH} fill="url(#tkRamp)" />
            <G clipPath="url(#tkClip)">
              <Rect x="0" y="4.5" width="24" height="2.4" fill="url(#tkAo1)" />
              <Rect x="0" y="17.1" width="24" height="2.4" fill="url(#tkAo2)" />
              <Rect x="0" y="0" width="24" height="1.5" fill="url(#tkHi)" />
              <Rect x="0" y="19.5" width="24" height="1.2" fill="url(#tkCatch)" />
            </G>
          </>
        ) : resolved === 'mono' ? (
          <Path d={MARK_PATH} fill={color ?? '#0D1B2A'} />
        ) : (
          <>
            <Path d={MARK_PATH} fill={color ?? '#0D1B2A'} />
            <Path d={CORE_PATH} fill={coreColor ?? '#0E8C8C'} />
          </>
        )}
      </Svg>
    </View>
  );
}
