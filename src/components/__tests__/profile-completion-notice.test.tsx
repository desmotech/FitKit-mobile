/**
 * The prompt that replaced a blocking gate.
 *
 * `AuthGate` used to redirect anyone with an incomplete profile to
 * /onboarding/complete-profile before they could reach a single tab, so a
 * member who had just paid met a form instead of their membership. The gate is
 * gone (see auth-gate.test.tsx); this is what stands in its place, and the
 * behaviour that matters is that it can be dismissed and stays dismissed.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileCompletionNotice } from '../home/profile-completion-notice';
import { renderWithProviders } from '../../../test/render';

const LABELS = {
  body: 'נשארו כמה פרטים להשלמה בפרופיל שלכם.',
  cta: 'להשלמה',
  dismiss: 'סגירה',
};

const KEY = 'taikan:settings:profileNoticeDismissed';

function renderNotice() {
  return renderWithProviders(
    <ProfileCompletionNotice isRTL labels={LABELS} />,
  );
}

describe('ProfileCompletionNotice', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('asks for the missing details without blocking anything', async () => {
    await renderNotice();

    await waitFor(() =>
      expect(screen.getByTestId('profile-completion-notice')).toBeOnTheScreen(),
    );
    expect(screen.getByText(LABELS.body)).toBeOnTheScreen();
  });

  it('goes away when the member dismisses it', async () => {
    await renderNotice();

    await waitFor(() =>
      expect(screen.getByTestId('profile-completion-notice')).toBeOnTheScreen(),
    );
    await userEvent.press(
      screen.getByTestId('profile-completion-notice-dismiss'),
    );

    expect(
      screen.queryByTestId('profile-completion-notice'),
    ).not.toBeOnTheScreen();
  });

  // A prompt that returns on every cold start is a gate with extra steps.
  it('stays dismissed after a restart', async () => {
    await AsyncStorage.setItem(KEY, 'true');

    await renderNotice();

    // Never appears at all — it starts hidden and the stored answer keeps it
    // that way, so there is no flash to wait out.
    await waitFor(() =>
      expect(
        screen.queryByTestId('profile-completion-notice'),
      ).not.toBeOnTheScreen(),
    );
  });

  it('records the dismissal so the next launch honours it', async () => {
    await renderNotice();

    await waitFor(() =>
      expect(screen.getByTestId('profile-completion-notice')).toBeOnTheScreen(),
    );
    await userEvent.press(
      screen.getByTestId('profile-completion-notice-dismiss'),
    );

    await waitFor(async () =>
      expect(await AsyncStorage.getItem(KEY)).toBe('true'),
    );
  });
});
