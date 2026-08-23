import { isLocalGuardBypassEnabled } from '@/app/lib/localGuardBypass';

describe('isLocalGuardBypassEnabled', () => {
  const originalFlag = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const originalHostname = process.env.YC_TEST_HOSTNAME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalFlag;
    process.env.YC_TEST_HOSTNAME = originalHostname;
  });

  it('is off when the flag is unset, whatever the host', () => {
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    process.env.YC_TEST_HOSTNAME = 'localhost';
    expect(isLocalGuardBypassEnabled()).toBe(false);
  });

  it.each(['localhost', 'LOCALHOST', '127.0.0.1'])('is on for %s', (hostname) => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = hostname;
    expect(isLocalGuardBypassEnabled()).toBe(true);
  });

  // The flag is NEXT_PUBLIC_, so its value ships inside the client bundle. A
  // build that sets it by mistake must not be able to render the private shell
  // on a deployed host.
  it.each(['app.example.com', 'staging.example.com', 'localhost.evil.test'])(
    'stays off for %s even with the flag set',
    (hostname) => {
      process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
      process.env.YC_TEST_HOSTNAME = hostname;
      expect(isLocalGuardBypassEnabled()).toBe(false);
    }
  );
});
