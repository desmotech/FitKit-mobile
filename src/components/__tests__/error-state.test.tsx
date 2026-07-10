/**
 * QueryErrorState is the app-wide "fetch failed" card — every read path
 * renders it instead of an empty state on error. If it breaks, failures
 * masquerade as "no data" again (the exact bug it was built to fix).
 */
import { screen, userEvent } from '@testing-library/react-native';
import { QueryErrorState } from '../error-state';
import { renderWithProviders } from '../../../test/render';

const PROPS = {
  title: 'לא הצלחנו לטעון',
  subtitle: 'בדקו את החיבור ונסו שוב',
  retryLabel: 'נסו שוב',
};

describe('QueryErrorState', () => {
  it('tells the member what failed and how to recover', async () => {
    await renderWithProviders(<QueryErrorState {...PROPS} onRetry={jest.fn()} />);

    expect(screen.getByText('לא הצלחנו לטעון')).toBeOnTheScreen();
    expect(screen.getByText('בדקו את החיבור ונסו שוב')).toBeOnTheScreen();
  });

  it('retries when the member taps the button', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<QueryErrorState {...PROPS} onRetry={onRetry} />);

    await userEvent.press(screen.getByRole('button', { name: 'נסו שוב' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('exposes the retry action to screen readers', async () => {
    await renderWithProviders(<QueryErrorState {...PROPS} onRetry={jest.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('נסו שוב');
  });
});
