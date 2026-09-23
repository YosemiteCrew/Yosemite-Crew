import { isNetworkError, networkErrorName, loadFailureMeta } from '../src/ui/load-error';

describe('isNetworkError', () => {
  // The codes the issue names, plus the rest of the connection family.
  test.each([
    [-21, 'ERR_NETWORK_CHANGED'],
    [-100, 'ERR_CONNECTION_CLOSED'],
    [-101, 'ERR_CONNECTION_RESET'],
    [-102, 'ERR_CONNECTION_REFUSED'],
    [-104, 'ERR_CONNECTION_FAILED'],
    [-105, 'ERR_NAME_NOT_RESOLVED'],
    [-106, 'ERR_INTERNET_DISCONNECTED'],
    [-109, 'ERR_ADDRESS_UNREACHABLE'],
    [-118, 'ERR_CONNECTION_TIMED_OUT'],
    [-130, 'ERR_PROXY_CONNECTION_FAILED'],
    [-137, 'ERR_NAME_RESOLUTION_FAILED'],
    [-138, 'ERR_NETWORK_ACCESS_DENIED'],
  ])('%i is network-class (%s)', (code, name) => {
    expect(isNetworkError(code)).toBe(true);
    expect(networkErrorName(code)).toBe(name);
  });

  // The host was reached, or nothing was attempted: these keep the error badge.
  test.each([
    [-2, 'ERR_FAILED'],
    [-3, 'ERR_ABORTED'],
    [-103, 'ERR_CONNECTION_ABORTED'],
    [-107, 'ERR_SSL_PROTOCOL_ERROR'],
    [-201, 'ERR_CERT_DATE_INVALID'],
    [-324, 'ERR_EMPTY_RESPONSE'],
    [0, 'no error'],
  ])('%i is not network-class (%s)', (code) => {
    expect(isNetworkError(code)).toBe(false);
    expect(networkErrorName(code)).toBeNull();
  });
});

describe('loadFailureMeta', () => {
  test('a lost connection sets offline and clears the error', () => {
    expect(loadFailureMeta(-106, 'ERR_INTERNET_DISCONNECTED')).toEqual({
      error: null,
      offline: true,
    });
  });

  test('a page error keeps the description and clears offline', () => {
    expect(loadFailureMeta(-201, 'ERR_CERT_DATE_INVALID')).toEqual({
      error: 'ERR_CERT_DATE_INVALID',
      offline: false,
    });
  });

  test('never sets both, so a tab never shows two badges', () => {
    for (const code of [-2, -21, -102, -106, -201, -324]) {
      const meta = loadFailureMeta(code, 'whatever');
      expect(meta.error !== null && meta.offline).toBe(false);
    }
  });
});
