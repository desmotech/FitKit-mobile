import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { font } from '@/lib/type';
import { type Locale } from '@/i18n/config';
import { FKLoadingBar } from '@/components/fk/loading-bar';

// "Taikan Splash" design ported to RN. The real brand globe replaces the
// design's tile+barbell, pinned where the native splash shows it for a
// seamless handoff; halo/wordmark/tagline/loader animate in around it.

const GLOBE = 160; // matches expo-splash-screen `imageWidth`
const HALO = 240;

const RISE = 16; // px the text/loader translate up on entrance
const HOLD_MS = 1900; // time on screen before fading out
const FADE_MS = 380;

const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

const THEME = {
  dark: {
    bg: '#07202B',
    text: '#F2F4F5',
    muted: 'rgba(232,238,242,0.64)',
    primary: '#36D6C6',
    track: 'rgba(255,255,255,0.10)',
  },
  light: {
    bg: '#F6F8FA',
    text: '#0D1B2A',
    muted: 'rgba(13,27,42,0.62)',
    primary: '#0E8C8C',
    track: 'rgba(13,27,42,0.10)',
  },
} as const;

// "Taikan" is a brand name — it stays. Only the tagline is localized.
const TAGLINE: Record<Locale, string> = {
  en: 'Train · Track · Progress',
  he: 'אימון · מעקב · התקדמות',
  ru: 'Тренируйся · Отслеживай · Прогресс',
};
// Assistant has no Cyrillic — route ru to Manrope (the app's ru body face).
const TAG_FONT: Record<Locale, string> = {
  en: font.monoMedium,
  he: font.monoMedium,
  ru: font.ruBodySemibold,
};

export function AnimatedSplash({
  dark,
  locale,
  onDone,
}: {
  dark: boolean;
  locale: Locale;
  onDone: () => void;
}) {
  const t = dark ? THEME.dark : THEME.light;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const root = useSharedValue(1);
  const halo = useSharedValue(reduced ? 1 : 0.55);
  const word = useSharedValue(reduced ? 1 : 0);
  const tag = useSharedValue(reduced ? 1 : 0);
  const loadWrap = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) {
      halo.value = withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      word.value = withDelay(780, withTiming(1, { duration: 600, easing: ENTER }));
      tag.value = withDelay(940, withTiming(1, { duration: 600, easing: ENTER }));
      loadWrap.value = withDelay(
        1050,
        withTiming(1, { duration: 600, easing: ENTER }),
      );
    }

    const hold = setTimeout(() => {
      root.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(onDone)();
      });
    }, reduced ? 700 : HOLD_MS);

    return () => clearTimeout(hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const haloStyle = useAnimatedStyle(() => ({
    // halo drives opacity .55→1 directly; scale tracks it .55→1 ⇒ 1→1.06
    opacity: halo.value,
    transform: [{ scale: 1 + ((halo.value - 0.55) / 0.45) * 0.06 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * RISE }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: (1 - tag.value) * RISE }],
  }));
  const loadWrapStyle = useAnimatedStyle(() => ({
    opacity: loadWrap.value,
    transform: [{ translateY: (1 - loadWrap.value) * RISE }],
  }));

  return (
    <Animated.View
      style={[styles.fill, { backgroundColor: t.bg }, rootStyle]}
      pointerEvents="auto"
    >
      {/* Pinned globe (+ pulsing halo) — dead centre, matching native splash. */}
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={[styles.haloWrap, haloStyle]}>
          <Svg width={HALO} height={HALO}>
            <Defs>
              <RadialGradient id="fkHalo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={t.primary} stopOpacity={0.33} />
                <Stop offset="68%" stopColor={t.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#fkHalo)" />
          </Svg>
        </Animated.View>
        <Image
          source={require('../../assets/images/splash.png')}
          style={{ width: GLOBE, height: GLOBE }}
          contentFit="contain"
        />
      </View>

      {/* Wordmark + tagline — sit just below the globe. */}
      <View style={styles.copy} pointerEvents="none">
        <Animated.Text
          style={[
            styles.word,
            { color: t.text, fontFamily: font.displayBold },
            wordStyle,
          ]}
        >
          Taikan
        </Animated.Text>
        <Animated.Text
          style={[
            styles.tag,
            { color: t.muted, fontFamily: TAG_FONT[locale] },
            tagStyle,
          ]}
        >
          {TAGLINE[locale]}
        </Animated.Text>
      </View>

      {/* Indeterminate loading bar. */}
      <Animated.View
        style={[styles.loader, { bottom: insets.bottom + 56 }, loadWrapStyle]}
        pointerEvents="none"
      >
        <FKLoadingBar color={t.primary} trackColor={t.track} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloWrap: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: GLOBE / 2 + 30,
    alignItems: 'center',
  },
  word: {
    fontSize: 46,
    letterSpacing: -2.1,
    lineHeight: 50,
  },
  tag: {
    fontSize: 12,
    letterSpacing: 2.9,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
