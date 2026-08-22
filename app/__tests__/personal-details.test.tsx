/**
 * /profile/personal — pins the read-only sign-in email: it is hydrated from
 * `/users/me`, labelled from the shared `common.email` dictionary, not
 * editable (Clerk owns the address), and never part of the PATCH payload.
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
