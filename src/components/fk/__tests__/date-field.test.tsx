/**
 * FKDateField's empty state used to hand the native picker `new Date()`,
 * which rendered *today* in the compact iOS chip even though nothing had
 * been picked — indistinguishable from a real answer. These pin the fix:
 * empty means a localized prompt, never a date; a value only ever lands
 * via an explicit pick.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { FKDateField } from '../date-field';
import { renderWithProviders } from '../../../../test/render';

// FKDateField is fully controlled (`value` / `onChange`), same as a real
// form screen would drive it — this harness stands in for that screen.
function Harness({
  initial = '',
  onChange,
}: {
  initial?: string;
  onChange?: (next: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <FKDateField
      testID="date-field"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('FKDateField — empty', () => {
  it('renders the localized prompt and no date text', async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByText('בחרו תאריך')).toBeTruthy();
    // The empty-state element is the prompt Pressable, not a picker —
    // it never carries the native picker's `mode`/`date` props.
    const el = screen.getByTestId('date-field');
    expect(el.props.mode).toBeUndefined();
    expect(el.props.date).toBeUndefined();
  });

  it('tapping the prompt opens a real picker instead of committing a value', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    fireEvent.press(screen.getByTestId('date-field'));

    // Mounting the picker must never itself answer the field.
    await waitFor(() =>
      expect(screen.getByTestId('date-field').props.mode).toBe('date'),
    );
    expect(screen.queryByText('בחרו תאריך')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with an ISO string once a date is actually picked', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    fireEvent.press(screen.getByTestId('date-field'));

    await waitFor(() =>
      expect(screen.getByTestId('date-field').props.mode).toBe('date'),
    );
    const picker = screen.getByTestId('date-field');
    const picked = new Date('2026-09-04T12:00:00');
    await act(async () => {
      picker.props.onChange({ nativeEvent: { timestamp: picked.getTime() } });
    });

    expect(onChange).toHaveBeenCalledWith('2026-09-04');
  });

  it('a dismissed picker leaves the field unanswered', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    fireEvent.press(screen.getByTestId('date-field'));

    await waitFor(() =>
      expect(screen.getByTestId('date-field').props.mode).toBe('date'),
    );
    const picker = screen.getByTestId('date-field');
    await act(async () => {
      picker.props.onPickerDismiss();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByText('בחרו תאריך')).toBeTruthy();
  });
});

describe('FKDateField — filled', () => {
  it('renders the chip, seeded from the value, with no prompt', async () => {
    await renderWithProviders(<Harness initial="1990-04-02" />);
    expect(screen.queryByText('בחרו תאריך')).toBeNull();

    const picker = screen.getByTestId('date-field');
    const seeded = new Date(picker.props.date as number);
    expect(
      [
        seeded.getFullYear(),
        String(seeded.getMonth() + 1).padStart(2, '0'),
        String(seeded.getDate()).padStart(2, '0'),
      ].join('-'),
    ).toBe('1990-04-02');
  });
});
