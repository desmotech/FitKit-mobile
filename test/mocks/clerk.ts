/**
 * Controllable Clerk state for tests. The module mock in test/setup.ts
 * reads from these objects on every hook call, so a test can flip
 * `mockAuthState.isSignedIn = false` (or swap `mockSignIn.create` with a
 * rejecting fn) and render — no per-test jest.mock ceremony.
 *
 * State resets to the defaults (signed-in member) after every test.
 */

export type MockAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: jest.Mock;
  signOut: jest.Mock;
};

const defaultAuth = (): MockAuthState => ({
  isLoaded: true,
  isSignedIn: true,
  userId: 'user_test',
  getToken: jest.fn(async () => 'test-jwt'),
  signOut: jest.fn(async () => undefined),
});

export const mockAuthState: MockAuthState = defaultAuth();

export const mockUserState: { user: Record<string, unknown> | null } = {
  user: {
    id: 'user_test',
    firstName: 'Test',
    lastName: 'Member',
    imageUrl: null,
    setProfileImage: jest.fn(),
    reload: jest.fn(),
  },
};

export const mockSignIn = {
  isLoaded: true,
  signIn: {
    create: jest.fn(),
    prepareSecondFactor: jest.fn(),
    attemptSecondFactor: jest.fn(),
    prepareFirstFactor: jest.fn(),
    attemptFirstFactor: jest.fn(),
    supportedSecondFactors: [] as unknown[],
  },
  setActive: jest.fn(async () => undefined),
};

export function resetClerkMocks() {
  Object.assign(mockAuthState, defaultAuth());
  mockUserState.user = {
    id: 'user_test',
    firstName: 'Test',
    lastName: 'Member',
    imageUrl: null,
    setProfileImage: jest.fn(),
    reload: jest.fn(),
  };
  mockSignIn.isLoaded = true;
  mockSignIn.signIn.create = jest.fn();
  mockSignIn.signIn.prepareSecondFactor = jest.fn();
  mockSignIn.signIn.attemptSecondFactor = jest.fn();
  mockSignIn.signIn.prepareFirstFactor = jest.fn();
  mockSignIn.signIn.attemptFirstFactor = jest.fn();
  mockSignIn.signIn.supportedSecondFactors = [];
  mockSignIn.setActive = jest.fn(async () => undefined);
}
