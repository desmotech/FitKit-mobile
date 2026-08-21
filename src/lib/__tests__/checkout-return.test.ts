import {
  checkoutOutcomeOf,
  checkoutReturnOf,
  statusParamOf,
  subParamOf,
} from '../checkout-return';

/**
 * The mapping that decides what a member is told after a checkout.
 *
 * Cardcom points its cancel and its failure redirect at the same URL unless
 * told otherwise, so a declined card used to arrive as "you cancelled" — the
 * member goes looking for a mistake they never made, and never learns the
 * card was refused. The API now sends a distinct `status=failed`, and every
 * ambiguity has to fall to `cancelled`: claiming success we never verified is
 * the one outcome that costs the member money.
 */
describe('checkoutOutcomeOf', () => {
  const url = (status?: string) =>
    status
      ? `fitkit://shop/payment-return?status=${status}&sub=sub_1`
      : 'fitkit://shop/payment-return?sub=sub_1';

  it('reads a successful return', () => {
    expect(checkoutOutcomeOf({ type: 'success', url: url('success') })).toBe(
      'success',
    );
  });

  it('keeps a declined card distinct from a cancelled one', () => {
    expect(checkoutOutcomeOf({ type: 'success', url: url('failed') })).toBe(
      'failed',
    );
    expect(checkoutOutcomeOf({ type: 'success', url: url('cancelled') })).toBe(
      'cancelled',
    );
  });

  it('treats a dismissed or interrupted browser session as cancelled', () => {
    expect(checkoutOutcomeOf({ type: 'dismiss' })).toBe('cancelled');
    expect(checkoutOutcomeOf({ type: 'cancel' })).toBe('cancelled');
    expect(checkoutOutcomeOf({ type: 'success', url: null })).toBe('cancelled');
  });

  it('assumes success only when the return URL carries no verdict of its own', () => {
    // The provider redirected to our success leg without echoing a status —
    // the return screen still verifies against the API before saying so.
    expect(checkoutOutcomeOf({ type: 'success', url: url() })).toBe('success');
  });
});

describe('statusParamOf', () => {
  it('finds the param wherever it sits in the query string', () => {
    expect(statusParamOf('fitkit://x?sub=1&status=failed')).toBe('failed');
    expect(statusParamOf('fitkit://x?status=cancelled&sub=1')).toBe('cancelled');
  });

  it('stops at a fragment and returns nothing when absent', () => {
    expect(statusParamOf('fitkit://x?sub=1')).toBeUndefined();
    expect(statusParamOf('fitkit://x?status=failed#frag')).toBe('failed');
  });
});

/**
 * The API appends `sub=<id>` to the CANCEL and FAILED legs as well as
 * success, so the return leg itself names the row to act on. The links reach
 * the app through `/payments/app-return`, which forwards its query untouched,
 * and `app/+native-intent.ts` only rewrites the path — so nothing on the way
 * strips the param.
 */
describe('subParamOf', () => {
  it('reads the subscription id off every leg', () => {
    expect(
      subParamOf('fitkit://shop/payment-return?status=cancelled&sub=sub_9'),
    ).toBe('sub_9');
    expect(
      subParamOf('fitkit://shop/payment-return?status=failed&sub=sub_9'),
    ).toBe('sub_9');
    expect(
      subParamOf('fitkit://shop/payment-return?sub=sub_9&status=success'),
    ).toBe('sub_9');
  });

  it('survives the app-return bridge shape', () => {
    // What the bridge forwards: the `to=` target plus the provider's params.
    expect(
      subParamOf(
        'fitkit://shop/payment-return?to=shop%2Fpayment-return&status=failed&sub=sub_bridge',
      ),
    ).toBe('sub_bridge');
  });

  it('reports nothing rather than an empty id when the leg is silent', () => {
    expect(subParamOf('fitkit://shop/payment-return?status=cancelled')).toBeUndefined();
    expect(
      subParamOf('fitkit://shop/payment-return?status=cancelled&sub='),
    ).toBeUndefined();
  });
});

describe('checkoutReturnOf', () => {
  it('reports the outcome and the subscription together', () => {
    expect(
      checkoutReturnOf({
        type: 'success',
        url: 'fitkit://shop/payment-return?status=failed&sub=sub_3',
      }),
    ).toEqual({ outcome: 'failed', subId: 'sub_3' });
  });

  it('leaves the subscription undefined so callers fall back rather than guess', () => {
    expect(checkoutReturnOf({ type: 'dismiss' })).toEqual({
      outcome: 'cancelled',
      subId: undefined,
    });
  });
});
