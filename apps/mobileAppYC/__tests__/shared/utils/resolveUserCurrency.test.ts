import {resolveUserCurrency} from '@/shared/utils/currency';

/**
 * There used to be three answers to "what currency is this user in": Edit
 * parent and Home hardcoded USD, the expenses thunk hardcoded USD, and
 * PreferencesContext derived it from the account country. A user with no
 * imperial country saw USD in some places and EUR in others, under the same
 * label. This is now the one derivation they all call.
 */
describe('resolveUserCurrency', () => {
  it('honours an explicit override above everything else', () => {
    expect(resolveUserCurrency('United States', 'EUR')).toBe('EUR');
    expect(resolveUserCurrency('Germany', 'USD')).toBe('USD');
  });

  it('gives USD for the imperial countries', () => {
    for (const country of ['United States', 'Myanmar', 'Liberia']) {
      expect(resolveUserCurrency(country)).toBe('USD');
    }
  });

  it('gives EUR everywhere else', () => {
    expect(resolveUserCurrency('Germany')).toBe('EUR');
    expect(resolveUserCurrency('India')).toBe('EUR');
  });

  it('gives EUR when no country is set, rather than defaulting to USD', () => {
    expect(resolveUserCurrency(undefined)).toBe('EUR');
    expect(resolveUserCurrency(null)).toBe('EUR');
    expect(resolveUserCurrency('')).toBe('EUR');
  });

  it('ignores a nullish override', () => {
    expect(resolveUserCurrency('United States', null)).toBe('USD');
    expect(resolveUserCurrency('Germany', undefined)).toBe('EUR');
  });
});
