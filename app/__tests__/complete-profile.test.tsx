/**
 * /onboarding/complete-profile — the blocking profile-completion gate.
 * These tests pin: hydration of the form from /users/me (a member returning
 * to finish a partial profile), field-level validation copy from the shared
 * `validation` dictionary (via completeProfileSchema's i18nKey params), the
 * exact PATCH /users/me payload, and the failure path (member stays put).
 *
 * The date field and the two selects are native controls, so the staged
 * user pre-fills everything except the national id — the one plain
 * TextInput the member still has to type into (it is deliberately never
 * hydrated from the server).
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@fitkit/shared';
import CompleteProfileScreen from '../onboarding/complete-profile';
import { formErrorSummary } from '@/lib/validation-i18n';
import { stageSignedInMember, userMe } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, unknown>>;
const cp = he.completeProfile as Record<string, unknown>;
const genderOptions = cp.genderOptions as Record<string, string>;
const validation = he.validation as Record<string, string>;
const SAVE = (he.common as Record<string, string>).save;

// Valid per the Israeli-ID checksum; 123456789 is NOT (used as the invalid case).
const VALID_ID = '123456782';
const INVALID_ID = '123456789';

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

/** Everything completeProfileSchema requires, except nationalId. */
const PROFILE = {
  firstName: 'דנה',
  lastName: 'כהן',
  phone: '050-1234567',
  birthDate: '1990-05-15',
  gender: 'female',
  emergencyContactName: 'יוסי כהן',
  emergencyContactPhone: '052-7654321',
  emergencyContactRelationship: 'parent',
} as const;

function stagePartialProfileMember() {
  stageSignedInMember(userMe({ profileComplete: false, ...PROFILE }));
}

function capturePatch(status = 200) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(api('/users/me'), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return status === 200
        ? HttpResponse.json({ data: userMe({ profileComplete: true }) })
        : HttpResponse.json({ message: 'nope' }, { status });
    }),
  );
  return bodies;
}

function idInput() {
  return screen.getByPlaceholderText(cp.nationalIdPlaceholder as string);
}

beforeEach(() => {
  mockRouterReplace.mockClear();
  stagePartialProfileMember();
});

describe('complete-profile onboarding gate', () => {
  it('hydrates the form with the values the member already has on file', async () => {
    await renderWithProviders(<CompleteProfileScreen />);

    expect(await screen.findByDisplayValue(PROFILE.firstName)).toBeOnTheScreen();
    expect(screen.getByDisplayValue(PROFILE.lastName)).toBeOnTheScreen();
    expect(screen.getByDisplayValue(PROFILE.phone)).toBeOnTheScreen();
    expect(
      screen.getByDisplayValue(PROFILE.emergencyContactName),
    ).toBeOnTheScreen();
    expect(
      screen.getByDisplayValue(PROFILE.emergencyContactPhone),
    ).toBeOnTheScreen();
    // The gender select shows the stored choice, not its placeholder.
    expect(screen.getByText(genderOptions.female)).toBeOnTheScreen();
    // The national id is deliberately never hydrated — the member must
    // (re-)enter it, so the field starts empty.
    expect(idInput().props.value).toBe('');
  });

  it('rejects an invalid national id with the dictionary message and never navigates', async () => {
    await renderWithProviders(<CompleteProfileScreen />);
    await screen.findByDisplayValue(PROFILE.firstName);

    await userEvent.type(idInput(), INVALID_ID);
    await userEvent.press(screen.getByRole('button', { name: SAVE }));

    // Field-level message straight from the shared validation dictionary
    // (completeProfileSchema tags the issue with i18nKey: 'idInvalid').
    expect(await screen.findByText(validation.idInvalid)).toBeOnTheScreen();
    // Plus the form-level summary from validation-i18n.
    expect(screen.getByText(formErrorSummary('he'))).toBeOnTheScreen();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('PATCHes the completed profile and replaces to the tabs', async () => {
    const bodies = capturePatch();
    await renderWithProviders(<CompleteProfileScreen />);
    await screen.findByDisplayValue(PROFILE.firstName);

    await userEvent.type(idInput(), VALID_ID);
    await userEvent.press(screen.getByRole('button', { name: SAVE }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    // The full completeProfileSchema payload: every hydrated value plus the
    // national id the member just typed.
    // israeliPhoneSchema (@fitkit/shared) normalizes phones to E.164 on
    // parse — the server receives +972…, not what the member typed.
    expect(bodies[0]).toEqual({
      ...PROFILE,
      nationalId: VALID_ID,
      phone: '+972501234567',
      emergencyContactPhone: '+972527654321',
    });
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)'),
    );
  });

  it('shows the save-failed copy and keeps the member on the screen when the PATCH fails', async () => {
    capturePatch(500);
    await renderWithProviders(<CompleteProfileScreen />);
    await screen.findByDisplayValue(PROFILE.firstName);

    await userEvent.type(idInput(), VALID_ID);
    await userEvent.press(screen.getByRole('button', { name: SAVE }));

    expect(await screen.findByText(cp.error as string)).toBeOnTheScreen();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
