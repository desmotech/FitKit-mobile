/**
 * These predicates decide whether Home treats a class as the member's
 * commitment — getting them wrong shows phantom bookings or hides real
 * ones from the "This week" rail and the Today gate.
 */
import { type GlanceSession, isCancelled, isMyBooking } from '../week-glance';

const session = (over: Partial<GlanceSession> = {}): GlanceSession => ({
  id: 'sess-1',
  startsAt: '2026-07-10T09:00:00.000Z',
  ...over,
});

describe('isMyBooking — which classes count as my commitment', () => {
  it('counts a confirmed seat', () => {
    expect(isMyBooking(session({ myBookingStatus: 'confirmed' }))).toBe(true);
  });

  it('counts a class I already attended', () => {
    expect(isMyBooking(session({ myBookingStatus: 'attended' }))).toBe(true);
  });

  it('does not count a waitlist spot — that was never a firm seat', () => {
    expect(isMyBooking(session({ myBookingStatus: 'waitlisted' }))).toBe(false);
  });

  it('does not count classes I have no relationship with', () => {
    expect(isMyBooking(session())).toBe(false);
    expect(isMyBooking(session({ myBookingStatus: null }))).toBe(false);
  });
});

describe('isCancelled — box-cancelled classes are not my miss', () => {
  it('flags a cancelled session', () => {
    expect(isCancelled(session({ status: 'cancelled' }))).toBe(true);
  });

  it('leaves published and draft sessions alone', () => {
    expect(isCancelled(session({ status: 'published' }))).toBe(false);
    expect(isCancelled(session({ status: 'draft' }))).toBe(false);
    expect(isCancelled(session())).toBe(false);
  });
});
