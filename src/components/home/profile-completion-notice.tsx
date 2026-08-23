/**
 * "Finish your profile" as a prompt, not a wall.
 *
 * This replaces a blocking redirect. `AuthGate` used to send anyone with an
 * incomplete profile to `/onboarding/complete-profile` before they could reach
 * a single tab — so a member who had just paid was shown a form asking for
 * their birth date instead of any sign their money had arrived. Web removed
 * the same gate for the same reason and kept a dismissible notice; mobile
 * never followed, so the two clients disagreed about what joining feels like.
 *
 * Worse than merely annoying: `getMe` returns the national id MASKED
 * (`***1234`), so a member who HAD given it at join was shown an empty
 * required field with nothing they could type that would satisfy it.
 *
 * The gym wants those fields; it does not need them before the member can use
 * what they bought. Editing lives where every other profile edit lives.
 */
import { UserPen, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import {
  loadProfileNoticeDismissed,
  saveProfileNoticeDismissed,
} from '@/lib/settings-store';

export function ProfileCompletionNotice({
  isRTL,
  labels,
}: {
  isRTL: boolean;
  labels: { body: string; cta: string; dismiss: string };
}) {
  const colors = useFKColors();
  const router = useRouter();
  // Starts dismissed so the notice fades in for the people who need it rather
  // than flashing on every cold start for the people who don't. AsyncStorage
  // is async, so there is no synchronous way to know on the first frame.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let active = true;
    void loadProfileNoticeDismissed().then((v) => {
      if (active) setDismissed(v);
    });
    return () => {
      active = false;
    };
  }, []);

  if (dismissed) return null;

  return (
    <View
      accessibilityRole="summary"
      testID="profile-completion-notice"
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryEdge,
        backgroundColor: colors.primarySoft,
      }}
    >
      <UserPen size={16} color={colors.primaryText} strokeWidth={2.2} />

      <Text
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          lineHeight: 18,
          color: colors.mutedFg,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {labels.body}
      </Text>

      <Pressable
        accessibilityRole="button"
        testID="profile-completion-notice-cta"
        hitSlop={8}
        onPress={() => router.push('/(tabs)/profile/personal')}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: colors.primaryText,
          }}
        >
          {labels.cta}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.dismiss}
        testID="profile-completion-notice-dismiss"
        hitSlop={8}
        onPress={() => {
          // Dismiss now, persist after. A storage failure must not leave the
          // notice on screen after the member has closed it.
          setDismissed(true);
          void saveProfileNoticeDismissed();
        }}
      >
        <X size={14} color={colors.subtleFg} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
