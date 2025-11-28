import { initPaymentSheet, presentPaymentSheet } from '../../../../src/features/payments/services/stripeFacade';

describe('stripeFacade', () => {
  beforeEach(() => {
    // Use fake timers to control setTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers after each test to avoid affecting other tests
    jest.useRealTimers();
  });

  describe('initPaymentSheet', () => {
    it('resolves successfully after the simulated delay', async () => {
      // 1. Call the function (it returns a pending promise)
      const promise = initPaymentSheet({});

      // 2. Fast-forward time by 150ms (the delay defined in the source)
      jest.advanceTimersByTime(150);

      // 3. Await the result
      const result = await promise;

      // 4. Assert success
      expect(result).toEqual({ success: true });
    });

    it('accepts optional parameters without error', async () => {
      const promise = initPaymentSheet({
        clientSecret: 'secret_123',
        customerId: 'cus_123',
        customerEphemeralKeySecret: 'eph_key_123',
      });

      jest.advanceTimersByTime(150);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('presentPaymentSheet', () => {
    it('resolves successfully after the simulated delay', async () => {
      // 1. Call the function
      const promise = presentPaymentSheet();

      // 2. Fast-forward time by 200ms (the delay defined in the source)
      jest.advanceTimersByTime(200);

      // 3. Await the result
      const result = await promise;

      // 4. Assert success
      expect(result).toEqual({ success: true });
    });
  });
});