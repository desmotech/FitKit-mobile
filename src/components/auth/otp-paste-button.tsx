/**
 * <OtpPasteButton> — one-tap fill for a verification code sitting on the
 * clipboard.
 *
 * `textContentType="oneTimeCode"` only covers Messages and Apple Mail; a code
 * that lands in Gmail never reaches the QuickType bar. The member copies it
 * there and comes back, so we offer the paste ourselves:
 *
 *   iOS 16+  → UIPasteControl (ClipboardPasteButton). Reads the clipboard
 *              on tap with no "Allow Paste" prompt and no clipboard access
 *              before then.
 *   else     → our own chip. The clipboard is read only when tapped, so
 *              Android never shows its "pasted from clipboard" toast for a
 *              code the member didn't ask us to use.
 *
 * Visible only while the clipboard actually holds text (`hasStringAsync`
 * needs no permission), re-checked whenever the app comes back to the front.
 */
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';

/** First run of exactly `length` digits — "Your Taikan code is 123456". */
export function extractOtp(text: string, length: number): string | null {
  const runs = text.match(/\d+/g);
  return runs?.find((run) => run.length === length) ?? null;
}

const PASTE_CONTROL_SIZE = { width: 168, height: 38 } as const;

export function OtpPasteButton({
  codeLength,
  onPaste,
  label,
  enabled = true,
}: {
  codeLength: number;
  onPaste: (code: string) => void;
  /** Fallback-chip label; UIPasteControl uses the system's own wording. */
  label: string;
  enabled?: boolean;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const [hasText, setHasText] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = () => {
      Clipboard.hasStringAsync()
        .then((has) => {
          if (alive) setHasText(has);
        })
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [enabled]);

  const accept = useCallback(
    (text: string | null | undefined) => {
      const code = text ? extractOtp(text, codeLength) : null;
      if (!code) {
        haptics.error();
        return;
      }
      haptics.success();
      onPaste(code);
    },
    [codeLength, haptics, onPaste],
  );

  if (!enabled || !hasText) return null;

  if (Clipboard.isPasteButtonAvailable) {
    return (
      <View style={{ alignItems: 'center' }}>
        <Clipboard.ClipboardPasteButton
          acceptedContentTypes={['plain-text']}
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          backgroundColor={colors.primarySoft}
          foregroundColor={colors.primaryText}
          style={PASTE_CONTROL_SIZE}
          onPress={(data) => {
            if (data.type === 'text') accept(data.text);
          }}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="otp-paste-chip"
      hitSlop={8}
      onPress={() => {
        Clipboard.getStringAsync()
          .then(accept)
          .catch(() => haptics.error());
      }}
      style={{ alignSelf: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          height: 38,
          borderRadius: 19,
          borderCurve: 'continuous',
          backgroundColor: colors.primarySoft,
          borderWidth: Platform.OS === 'android' ? 0 : 1,
          borderColor: colors.primaryEdge,
        }}
      >
        <ClipboardPaste size={16} color={colors.primaryText} strokeWidth={2} />
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: colors.primaryText }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
