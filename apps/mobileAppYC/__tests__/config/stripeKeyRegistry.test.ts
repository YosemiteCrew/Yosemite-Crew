import {
  getResolvedStripePublishableKey,
  setResolvedStripePublishableKey,
} from '@/config/stripeKeyRegistry';

describe('stripeKeyRegistry', () => {
  afterEach(() => {
    setResolvedStripePublishableKey('');
  });

  it('returns an empty key until one is resolved', () => {
    expect(getResolvedStripePublishableKey()).toBe('');
  });

  it('stores and returns the resolved publishable key', () => {
    setResolvedStripePublishableKey('pk_test_resolved');

    expect(getResolvedStripePublishableKey()).toBe('pk_test_resolved');
  });
});
