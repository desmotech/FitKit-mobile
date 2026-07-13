/**
 * Buyer-side course types — local mirrors of the `course.schema.ts`
 * response shapes in `@fitkit/shared` (courseEntitlementResponseSchema and
 * friends).
 *
 * Mirrored rather than imported because the pinned `@fitkit/shared` release
 * (0.1.25) predates the course sessions/RSVP/materials schemas — importing
 * them would break the lockfile-frozen CI install. Delete this file and
 * import from `@fitkit/shared` once the dependency is bumped to ≥0.1.35.
 */

export interface CourseDayWorkout {
  id: string;
  /** Library workout id — the `:workoutId` in every player endpoint and the
   *  value `completedCourseWorkoutIds` contains. Null on rest markers. */
  workoutId: string | null;
  isRest: boolean;
  sortOrder: number;
  workout: {
    id: string;
    title: string | null;
    description: string | null;
  } | null;
}

export interface CourseDay {
  dayOffset: number;
  isRest: boolean;
  workouts: CourseDayWorkout[];
}

export type CoursePublishStatus =
  | 'draft'
  | 'published'
  | 'cancelled'
  | 'archived';

export type CourseRsvpStatus = 'booked' | 'cancelled';

/** A scheduled live/in-person course meeting, with the caller's RSVP state. */
export interface CourseSession {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationId: string | null;
  locationName: string | null;
  locationText: string | null;
  capacity: number | null;
  status: CoursePublishStatus;
  createdAt: string;
  updatedAt: string;
  bookedCount: number;
  myRsvpStatus: CourseRsvpStatus | null;
}

export type CourseMaterialKind = 'file' | 'link' | 'video';

export interface CourseMaterial {
  id: string;
  programId: string;
  /** Null = whole-course material; otherwise pinned to that curriculum day. */
  dayOffset: number | null;
  kind: CourseMaterialKind;
  title: string;
  description: string | null;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** One owned course as `/me/courses` (list) and `/me/courses/:id` (player)
 *  return it. `days` is omitted from the list response for payload size. */
export interface CourseEntitlement {
  id: string;
  programId: string;
  startDate: string | null;
  completedAt: string | null;
  restartCount: number;
  accessRevokedAt: string | null;
  createdAt: string;
  course: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    durationDays: number;
  };
  /** Seller-org brand — rendered per-card because the library is cross-org
   *  (entitlements follow the user, not the active org). */
  organization: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
  };
  days?: CourseDay[];
  /** Library workout ids the buyer marked complete — day/course completion
   *  is derived from this, never persisted separately. */
  completedCourseWorkoutIds: string[];
  currentDayOffset: number | null;
  totalCompletedDays: number;
  sessions: CourseSession[];
  materials: CourseMaterial[];
}

export interface CourseWorkoutMovement {
  id: string;
  sortOrder: number;
  label: string | null;
  supersetGroup: string | null;
  prescription: Record<string, unknown> | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    slug: string | null;
  };
}

export interface CourseWorkoutSection {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  shape: string | null;
  config: Record<string, unknown> | null;
  sortOrder: number;
  movements: CourseWorkoutMovement[];
}

/** GET /me/courses/:id/workouts/:workoutId — the full program sheet. */
export interface CourseWorkoutDetail {
  id: string;
  title: string | null;
  description: string | null;
  sections: CourseWorkoutSection[];
}
