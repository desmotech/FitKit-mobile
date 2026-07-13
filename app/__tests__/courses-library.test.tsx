/**
 * Course library — the Courses tab root. Pins the member-visible contract:
 * owned courses render with their SELLER-org name (the library is
 * cross-org), revoked entitlements never appear, tapping a card opens the
 * player, and the empty/error states show their copy.
 *
 * Network staged via MSW; the member drives the real screen.
 */
import { screen, userEvent } from '@testing-library/react-native';
import CoursesLibraryScreen from '../(tabs)/courses/index';
import { coursesStringsFor } from '@/i18n/courses-strings';
import { courseEntitlement, stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const CS = coursesStringsFor('he');

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

function stageLibrary(entitlements: unknown[]) {
  server.use(
    http.get(api('/me/courses'), () =>
      HttpResponse.json({ data: entitlements }),
    ),
  );
}

/** Member header chrome (unread badges) — same staging as the Home test. */
function stageHeaderChrome() {
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/announcements/unread-count`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
  );
}

beforeEach(() => {
  mockRouterPush.mockClear();
  stageSignedInMember();
  stageHeaderChrome();
});

describe('Course library — list', () => {
  it('renders each owned course with its seller-org name and duration', async () => {
    stageLibrary([
      courseEntitlement({
        startDate: null,
        organization: {
          id: 'org_other',
          name: 'Other Gym',
          slug: null,
          logoUrl: null,
        },
      }),
    ]);

    await renderWithProviders(<CoursesLibraryScreen />);

    expect(await screen.findByText('Kettlebell Foundations')).toBeOnTheScreen();
    // Seller-org branding — NOT the active org. The library is cross-org.
    expect(screen.getByText('Other Gym')).toBeOnTheScreen();
    expect(
      screen.getByText(CS.durationDays.replace('{n}', '2')),
    ).toBeOnTheScreen();
    expect(screen.getByText(CS.notStartedBadge)).toBeOnTheScreen();
  });

  it('shows day progress for a started course and the completed badge for a finished one', async () => {
    stageLibrary([
      courseEntitlement({ totalCompletedDays: 1 }),
      courseEntitlement({
        id: 'ent_2',
        programId: 'prog_course_2',
        completedAt: '2026-07-10T10:00:00.000Z',
        course: {
          id: 'prog_course_2',
          name: 'Mobility Reset',
          description: null,
          imageUrl: null,
          durationDays: 7,
        },
      }),
    ]);

    await renderWithProviders(<CoursesLibraryScreen />);

    expect(
      await screen.findByText(
        CS.daysProgress.replace('{n}', '1').replace('{total}', '2'),
      ),
    ).toBeOnTheScreen();
    // The finished course carries the badge (chip + progress line).
    expect(screen.getAllByText(CS.completedBadge).length).toBeGreaterThan(0);
  });

  it('never renders a revoked entitlement', async () => {
    stageLibrary([
      courseEntitlement({
        accessRevokedAt: '2026-07-05T00:00:00.000Z',
      }),
    ]);

    await renderWithProviders(<CoursesLibraryScreen />);

    expect(await screen.findByText(CS.libraryEmptyTitle)).toBeOnTheScreen();
    expect(screen.queryByText('Kettlebell Foundations')).not.toBeOnTheScreen();
  });

  it('opens the player for the tapped course', async () => {
    stageLibrary([courseEntitlement()]);
    await renderWithProviders(<CoursesLibraryScreen />);
    await screen.findByText('Kettlebell Foundations');

    await userEvent.press(
      screen.getByRole('button', { name: 'Kettlebell Foundations' }),
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/courses/[id]',
      params: { id: 'prog_course_1' },
    });
  });
});

describe('Course library — empty and error states', () => {
  it('shows the empty state when the member owns nothing', async () => {
    stageLibrary([]);

    await renderWithProviders(<CoursesLibraryScreen />);

    expect(await screen.findByText(CS.libraryEmptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(CS.libraryEmptyBody)).toBeOnTheScreen();
  });

  it('shows the error state with retry on load failure', async () => {
    server.use(
      // 401: fails fast by design (useApiQuery skips retries for it).
      http.get(api('/me/courses'), () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );

    await renderWithProviders(<CoursesLibraryScreen />);

    expect(await screen.findByText(CS.loadFailedTitle)).toBeOnTheScreen();
    expect(screen.getByText(CS.tryAgain)).toBeOnTheScreen();
  });
});
