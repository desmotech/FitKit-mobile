/**
 * Course workout view — the program sheet behind a player day row. Pins
 * the member-visible contract: the staged workout renders its movements,
 * the complete/undo round-trip hits POST/DELETE …/complete and flips the
 * CTA cluster, and the tick that finishes the whole course raises the
 * one-time celebration alert.
 *
 * Network staged via MSW; the member drives the real screen.
 */
import {
  act,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import CourseWorkoutScreen from '../(tabs)/courses/[id]/workout/[workoutId]';
import { coursesStringsFor } from '@/i18n/courses-strings';
import {
  courseEntitlement,
  courseWorkoutDetail,
  stageSignedInMember,
} from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';

const CS = coursesStringsFor('he');
const COURSE = 'prog_course_1';
const WORKOUT = 'w_course_1';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({
    id: 'prog_course_1',
    workoutId: 'w_course_1',
  }),
}));

/** Stages the workout read + the entitlement (mutable — owns completion). */
function stageWorkout(initialEntitlement = courseEntitlement()) {
  const state = { entitlement: initialEntitlement };
  server.use(
    http.get(api(`/me/courses/${COURSE}/workouts/${WORKOUT}`), () =>
      HttpResponse.json({ data: courseWorkoutDetail() }),
    ),
    http.get(api(`/me/courses/${COURSE}`), () =>
      HttpResponse.json({ data: state.entitlement }),
    ),
    http.get(api('/me/courses'), () =>
      HttpResponse.json({ data: [state.entitlement] }),
    ),
  );
  return state;
}

async function flushRender() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  stageSignedInMember();
});

describe('Course workout — content', () => {
  it('renders the workout name and its movements', async () => {
    stageWorkout();

    await renderWithProviders(<CourseWorkoutScreen />);

    expect(await screen.findByText('Foundations A')).toBeOnTheScreen();
    expect(await screen.findByText('Kettlebell Swing')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: CS.markCompleted }),
    ).toBeOnTheScreen();
  });
});

describe('Course workout — completion round-trip', () => {
  it('POSTs …/complete and flips the CTA to the done state', async () => {
    const state = stageWorkout();
    const completeUrls: string[] = [];
    server.use(
      http.post(
        api(`/me/courses/${COURSE}/workouts/${WORKOUT}/complete`),
        ({ request }) => {
          completeUrls.push(request.url);
          state.entitlement = courseEntitlement({
            completedCourseWorkoutIds: [WORKOUT],
            totalCompletedDays: 1,
          });
          // Not the last workout of the course — no course completedAt.
          return HttpResponse.json({ data: { completedAt: null } });
        },
      ),
    );
    await renderWithProviders(<CourseWorkoutScreen />);
    await screen.findByText('Foundations A');
    await flushRender();

    await userEvent.press(
      screen.getByRole('button', { name: CS.markCompleted }),
    );

    await waitFor(() => expect(completeUrls).toHaveLength(1));
    expect(await screen.findByText(CS.completed)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: CS.undo })).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: CS.markCompleted }),
      ).not.toBeOnTheScreen(),
    );
  });

  it('offers Undo on a completed workout and DELETEs …/complete', async () => {
    const state = stageWorkout(
      courseEntitlement({
        completedCourseWorkoutIds: [WORKOUT],
        totalCompletedDays: 1,
      }),
    );
    const deleteUrls: string[] = [];
    server.use(
      http.delete(
        api(`/me/courses/${COURSE}/workouts/${WORKOUT}/complete`),
        ({ request }) => {
          deleteUrls.push(request.url);
          state.entitlement = courseEntitlement();
          return HttpResponse.json({ data: { completedAt: null } });
        },
      ),
    );
    await renderWithProviders(<CourseWorkoutScreen />);

    expect(await screen.findByText(CS.completed)).toBeOnTheScreen();
    await flushRender();

    await userEvent.press(screen.getByRole('button', { name: CS.undo }));

    await waitFor(() => expect(deleteUrls).toHaveLength(1));
    expect(
      await screen.findByRole('button', { name: CS.markCompleted }),
    ).toBeOnTheScreen();
  });

  it('celebrates once when the tick completes the whole course', async () => {
    const state = stageWorkout();
    server.use(
      http.post(
        api(`/me/courses/${COURSE}/workouts/${WORKOUT}/complete`),
        () => {
          state.entitlement = courseEntitlement({
            completedCourseWorkoutIds: [WORKOUT],
            totalCompletedDays: 1,
            completedAt: '2026-07-13T10:00:00.000Z',
          });
          return HttpResponse.json({
            data: { completedAt: '2026-07-13T10:00:00.000Z' },
          });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<CourseWorkoutScreen />);
    await screen.findByText('Foundations A');
    await flushRender();

    await userEvent.press(
      screen.getByRole('button', { name: CS.markCompleted }),
    );

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        CS.courseCompleteTitle,
        CS.courseCompleteBody,
      ),
    );
    alertSpy.mockRestore();
  });
});
