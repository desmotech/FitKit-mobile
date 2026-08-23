/**
 * /profile/personal — pins the read-only sign-in email: it is hydrated from
 * `/users/me`, labelled from the shared `common.email` dictionary, not
 * editable (Clerk owns the address), and never part of the PATCH payload.
 *
 * Also pins the birth date as a native picker rather than a typed string —
 * the field this screen and its onboarding twin both promise.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import PersonalDetailsScreen from '../(tabs)/profile/personal';
import { stageSignedInMember, userMe } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, unknown>>;
const common = he.common as Record<string, string>;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

const EMAIL = 'saar@usetaikan.com';

function capturePatch() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(api('/users/me'), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ data: userMe({ email: EMAIL }) });
    }),
  );
  return bodies;
}

beforeEach(() => {
  stageSignedInMember(
    userMe({ email: EMAIL, firstName: 'סער', lastName: 'קוריאל' }),
  );
});

describe('personal details — sign-in email', () => {
  it('shows the address from /users/me under the localized label', async () => {
    await renderWithProviders(<PersonalDetailsScreen />);

    expect(await screen.findByDisplayValue(EMAIL)).toBeOnTheScreen();
    expect(screen.getByText(common.email)).toBeOnTheScreen();
  });

  it('renders it read-only', async () => {
    await renderWithProviders(<PersonalDetailsScreen />);
    await screen.findByDisplayValue(EMAIL);

    expect(screen.getByTestId('personal-email').props.editable).toBe(false);
  });

  it('leaves it out of the PATCH payload', async () => {
    const bodies = capturePatch();
    await renderWithProviders(<PersonalDetailsScreen />);
    await screen.findByDisplayValue(EMAIL);

    // FKBtn puts no accessibilityRole on its Pressable — press the label and
    // let fireEvent walk up to the handler.
    fireEvent.press(screen.getByText(common.save));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('email');
  });
});

/**
 * Birth date is a date, not a string a member should have to spell as
 * YYYY-MM-DD. The onboarding twin (app/onboarding/complete-profile.tsx) has
 * always used the native wheel; this screen shipped a free-text Input, so
 * editing a birth date here opened a keyboard instead of a picker.
 */
describe('personal details — birth date', () => {
  const BIRTH_DATE = '1990-04-02';

  beforeEach(() => {
    stageSignedInMember(userMe({ email: EMAIL, birthDate: BIRTH_DATE }));
  });

  it('renders the native date picker, seeded from /users/me', async () => {
    await renderWithProviders(<PersonalDetailsScreen />);
    await screen.findByDisplayValue(EMAIL);

    // `date` is the native picker's own prop — its presence IS the assertion
    // that a picker, not a text field, is mounted.
    const picker = screen.getByTestId('personal-birth-date');
    const seeded = new Date(picker.props.date as number);
    expect(
      [
        seeded.getFullYear(),
        String(seeded.getMonth() + 1).padStart(2, '0'),
        String(seeded.getDate()).padStart(2, '0'),
      ].join('-'),
    ).toBe(BIRTH_DATE);
  });

  it('offers no free-text field to type the date into', async () => {
    await renderWithProviders(<PersonalDetailsScreen />);
    await screen.findByDisplayValue(EMAIL);

    expect(screen.queryByDisplayValue(BIRTH_DATE)).toBeNull();
  });
});
