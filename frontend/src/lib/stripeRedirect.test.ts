import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assignStripeHostedUrl } from './stripeRedirect';

describe('assignStripeHostedUrl', () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal('location', { assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows checkout.stripe.com', () => {
    assignStripeHostedUrl('https://checkout.stripe.com/c/pay/cs_test_abc');
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_abc');
  });

  it('allows billing.stripe.com portal URLs', () => {
    assignStripeHostedUrl('https://billing.stripe.com/p/session/test');
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test');
  });

  it('rejects malformed URLs', () => {
    expect(() => assignStripeHostedUrl('not-a-url')).toThrow(/Invalid billing redirect URL/);
    expect(assign).not.toHaveBeenCalled();
  });

  it('rejects non-Stripe hosts', () => {
    expect(() => assignStripeHostedUrl('https://evil.test/checkout')).toThrow(/Untrusted/);
    expect(assign).not.toHaveBeenCalled();
  });
});
