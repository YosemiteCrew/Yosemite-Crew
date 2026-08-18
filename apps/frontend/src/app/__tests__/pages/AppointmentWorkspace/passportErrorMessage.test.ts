import { getPassportErrorMessage } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportErrorMessage';

const FALLBACK = 'Unable to save this record. Please try again.';

describe('getPassportErrorMessage', () => {
  it('prefers the message the backend rejected the payload with', () => {
    expect(
      getPassportErrorMessage({ response: { data: { message: 'Invalid request body' } } }, FALLBACK)
    ).toBe('Invalid request body');
  });

  it('reads the alternate `error` field some routes answer with', () => {
    expect(getPassportErrorMessage({ response: { data: { error: 'Forbidden' } } }, FALLBACK)).toBe(
      'Forbidden'
    );
  });

  it('ignores a blank or non-string server message', () => {
    expect(getPassportErrorMessage({ response: { data: { message: '   ' } } }, FALLBACK)).toBe(
      FALLBACK
    );
    expect(getPassportErrorMessage({ response: { data: { message: 42 } } }, FALLBACK)).toBe(
      FALLBACK
    );
  });

  it('falls back through a response without a usable body', () => {
    expect(getPassportErrorMessage({ response: {} }, FALLBACK)).toBe(FALLBACK);
    expect(getPassportErrorMessage({ response: { data: 'boom' } }, FALLBACK)).toBe(FALLBACK);
  });

  it('uses a local Error message when the failure never reached the server', () => {
    expect(getPassportErrorMessage(new Error('No active organisation selected.'), FALLBACK)).toBe(
      'No active organisation selected.'
    );
    expect(getPassportErrorMessage(new Error('  '), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for anything else', () => {
    expect(getPassportErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getPassportErrorMessage('nope', FALLBACK)).toBe(FALLBACK);
  });
});
