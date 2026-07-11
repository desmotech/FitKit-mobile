/**
 * QR scanner — full-screen modal launched from the session detail sheet.
 *
 * Scans a `fitkit:`/`https://app.fitkit.fit/...` URL containing a session id,
 * token, and expiry. Parses the params and posts to `/sessions/:id/self-checkin`
 * with `{ method: 'qr', token, expiresAt }`. On success, navigates back to
 * Schedule with a haptic confirmation; on error, surfaces the message inline.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  extractApiErrorMessage,
  useSelfCheckin,
} from '@/hooks/use-schedule';
import { getWeekStartDay, weekStartFor } from '@/hooks/use-workouts';
import { useI18n } from '@/providers/i18n-provider';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const { lang, t: dict, dir } = useI18n();
  const isRTL = dir === 'rtl';
  const weekStart = weekStartFor(new Date(), getWeekStartDay(lang));

  const labels = useMemo(() => {
    const t = (dict as unknown as {
      schedule?: { scanner?: Record<string, string> };
      common?: Record<string, string>;
    });
    const scanT = t.schedule?.scanner ?? {};
    const commonT = t.common ?? {};
    return {
      hint: scanT.hint ?? 'Point your camera at the gym QR',
      busy: scanT.busy ?? 'Checking you in…',
      success: scanT.success ?? "You're in!",
      invalidQr: scanT.invalidQr ?? 'Invalid QR code',
      expiredQr: scanT.expiredQr ?? 'This QR code has expired',
      unreadable: scanT.unreadable ?? 'Could not read QR code',
      failed: scanT.failed ?? 'Check-in failed',
      cameraNeeded: scanT.cameraNeeded ?? 'Camera access needed',
      cameraDesc:
        scanT.cameraDesc ??
        'FitKit uses the camera to scan check-in QR codes at your gym.',
      allowCamera: scanT.allowCamera ?? 'Allow camera',
      openSettings: scanT.openSettings ?? 'Open Settings',
      cancel: commonT.cancel ?? 'Cancel',
      tryAgain: commonT.tryAgain ?? 'Try again',
    };
  }, [dict]);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Debounce: a single QR can fire onBarcodeScanned dozens of times per
  // second. We disable further reads once we've handled the first hit.
  const handled = useRef(false);

  const checkin = useSelfCheckin(orgId, weekStart);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (handled.current || busy) return;
      try {
        // Accept either fitkit:// deep link or https URL — both carry the
        // same query params (org, s, t, e).
        const url = new URL(data);
        const params = url.searchParams;
        const sessionFromQr = params.get('s');
        const token = params.get('t');
        const exp = params.get('e');

        if (!sessionFromQr || !token || !exp) {
          setError(labels.invalidQr);
          return;
        }
        // If the QR is for a different session than the one we came from,
        // we still honor the QR (it's the source of truth at the gym).
        const targetSessionId = sessionFromQr;
        const expiresAt = Number.parseInt(exp, 10);
        if (Number.isNaN(expiresAt) || expiresAt * 1000 < Date.now()) {
          setError(labels.expiredQr);
          return;
        }

        handled.current = true;
        setBusy(true);
        setError(null);
        checkin.mutate(
          {
            sessionId: targetSessionId,
            body: { method: 'qr', token, expiresAt },
          },
          {
            onSuccess: () => {
              haptics.success();
              setSuccess(true);
              setTimeout(() => router.back(), 900);
            },
            onError: (err) => {
              handled.current = false;
              setBusy(false);
              setError(extractApiErrorMessage(err, labels.failed));
            },
          },
        );
      } catch {
        setError(labels.unreadable);
      }
    },
    [busy, checkin, haptics, router, labels],
  );

  function handleClose() {
    haptics.tap();
    router.back();
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ActivityIndicator style={{ flex: 1 }} color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <Text
          className="font-display font-bold"
          style={{
            color: '#fff',
            fontSize: 17,
            textAlign: 'center',
            letterSpacing: -0.3,
          }}
        >
          {labels.cameraNeeded}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 18,
            maxWidth: 280,
          }}
        >
          {labels.cameraDesc}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (permission.canAskAgain) requestPermission();
            else Linking.openSettings();
          }}
          style={{
            marginTop: 8,
            paddingHorizontal: 18,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0E8C8C',
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: -0.1,
            }}
          >
            {permission.canAskAgain ? labels.allowCamera : labels.openSettings}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleClose}
          style={{ marginTop: 4 }}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {labels.cancel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled.current ? undefined : handleScanned}
      />

      {/* Reticle */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 28,
            borderWidth: 3,
            borderColor: success
              ? '#22C55E'
              : error
                ? '#F87171'
                : 'rgba(255,255,255,0.85)',
            backgroundColor: 'transparent',
          }}
        />
      </View>

      {/* Hint */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 70,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '600',
              letterSpacing: -0.1,
            }}
          >
            {/* success wins over busy: onSuccess leaves `busy` true while
                the 900ms return-to-schedule timer runs. */}
            {success ? labels.success : busy ? labels.busy : labels.hint}
          </Text>
        </View>
      </View>

      {/* Success / error toast */}
      {success ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: 'rgba(34,197,94,0.18)',
              borderWidth: 2,
              borderColor: 'rgba(34,197,94,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={36} color="#22C55E" strokeWidth={2.4} />
          </View>
        </Animated.View>
      ) : null}

      {error ? (
        <View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 100,
            padding: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(184,74,64,0.92)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '700',
              textAlign: 'center',
              letterSpacing: -0.1,
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setError(null);
              handled.current = false;
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: '800',
                textDecorationLine: 'underline',
              }}
            >
              {labels.tryAgain}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Close affordance — leading-edge pill with icon + localized
          "Cancel" label. RTL-aware (top-right in RTL, top-left in LTR)
          and large enough to be unmissable against any camera content.
          The native swipe-back gesture is unreliable while CameraView
          owns touches, so we surface this as the primary exit. */}
      <Pressable
        onPress={handleClose}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel={labels.cancel}
        style={({ pressed }) => [
          {
            position: 'absolute',
            top: insets.top + 8,
            ...(isRTL ? { right: 14 } : { left: 14 }),
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: isRTL ? 14 : 10,
            paddingRight: isRTL ? 10 : 14,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.62)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <X size={18} color="#fff" strokeWidth={2.6} />
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: -0.1,
          }}
        >
          {labels.cancel}
        </Text>
      </Pressable>

      {/* Hide the unused id param warning */}
      {id ? null : null}
    </View>
  );
}
