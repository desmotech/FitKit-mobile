/**
 * Controllable clipboard state for tests. The module mock in test/setup.ts
 * reads from this object, so a test can set `mockClipboard.text` (and flip
 * `pasteButtonAvailable` to exercise the iOS UIPasteControl branch) without
 * per-test jest.mock ceremony. Resets after every test.
 */
import { Pressable } from 'react-native';

export type MockClipboard = {
  text: string | null;
  pasteButtonAvailable: boolean;
};

export const mockClipboard: MockClipboard = {
  text: null,
  pasteButtonAvailable: false,
};

export function resetClipboardMock() {
  mockClipboard.text = null;
  mockClipboard.pasteButtonAvailable = false;
}

/** Stands in for UIPasteControl, which can't render under Jest. */
export function MockClipboardPasteButton({
  onPress,
}: {
  onPress: (data: { type: 'text'; text: string }) => void;
}) {
  return (
    <Pressable
      testID="clipboard-paste-button"
      accessibilityRole="button"
      onPress={() => onPress({ type: 'text', text: mockClipboard.text ?? '' })}
    />
  );
}
