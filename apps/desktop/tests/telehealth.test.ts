import {
  BUILTIN_PROVIDERS,
  TELEHEALTH_PROVIDER_ID,
  buildTelehealthDeepLink,
  buildTelehealthPath,
  buildTelehealthUrl,
  getProvider,
  listProviders,
  parseTelehealthLaunchInput,
  resolveStreamCallId,
  streamCallIdForAppointment,
} from '../src/utils/telehealth';

describe('GetStream telehealth provider', () => {
  test('exposes only GetStream as a supported telehealth provider', () => {
    expect(Object.keys(BUILTIN_PROVIDERS)).toEqual([TELEHEALTH_PROVIDER_ID]);
    expect(listProviders()).toEqual([
      expect.objectContaining({
        id: 'getstream',
        name: 'GetStream Telehealth',
        backend: 'getstream',
      }),
    ]);
    expect(getProvider('getstream')).toBeDefined();
    expect(getProvider('zoom')).toBeUndefined();
  });
});

describe('Stream call IDs', () => {
  test('derives a stable call ID from an appointment ID', () => {
    expect(streamCallIdForAppointment('appt-123')).toBe('yc-appt-appt-123');
  });

  test('uses explicit callId over appointment-derived IDs', () => {
    expect(
      resolveStreamCallId({
        appointmentId: 'appt-123',
        callId: 'stream-call-456',
      })
    ).toBe('stream-call-456');
  });

  test('rejects unsafe appointment IDs', () => {
    expect(streamCallIdForAppointment('../secret')).toBeNull();
    expect(streamCallIdForAppointment('')).toBeNull();
  });
});

describe('parseTelehealthLaunchInput', () => {
  test('accepts an empty input for the appointment telehealth landing flow', () => {
    expect(parseTelehealthLaunchInput(undefined)).toEqual({
      ok: true,
      intent: {},
    });
  });

  test('normalizes valid launch IDs', () => {
    expect(
      parseTelehealthLaunchInput({
        appointmentId: ' appt-123 ',
        callId: 'call_456',
        companionId: 'comp.789',
      })
    ).toEqual({
      ok: true,
      intent: {
        appointmentId: 'appt-123',
        callId: 'call_456',
        companionId: 'comp.789',
      },
    });
  });

  test('rejects malformed inputs and unsafe IDs', () => {
    expect(parseTelehealthLaunchInput('bad')).toEqual({
      ok: false,
      error: 'invalid-telehealth-intent',
    });
    expect(parseTelehealthLaunchInput({ appointmentId: '<script>' })).toEqual({
      ok: false,
      error: 'invalid-appointment-id',
    });
    expect(parseTelehealthLaunchInput({ callId: '../x' })).toEqual({
      ok: false,
      error: 'invalid-call-id',
    });
  });

  test('accepts null input same as undefined', () => {
    expect(parseTelehealthLaunchInput(null)).toEqual({ ok: true, intent: {} });
  });

  test('rejects invalid companionId', () => {
    expect(parseTelehealthLaunchInput({ companionId: '../evil' })).toEqual({
      ok: false,
      error: 'invalid-companion-id',
    });
  });

  test('empty strings are treated as invalid IDs', () => {
    expect(
      parseTelehealthLaunchInput({
        appointmentId: '',
        callId: 'valid',
        companionId: 'ok',
      })
    ).toEqual({
      ok: false,
      error: 'invalid-appointment-id',
    });
  });
});

describe('telehealth URLs', () => {
  test('builds the PIMS appointment telehealth path with GetStream params', () => {
    expect(buildTelehealthPath({ appointmentId: 'appt-123' })).toBe(
      '/appointments?action=telehealth&provider=getstream&callId=yc-appt-appt-123&appointmentId=appt-123'
    );
  });

  test('builds an internal desktop URL against the configured PIMS origin', () => {
    expect(
      buildTelehealthUrl('https://www.yosemitecrew.com/signin', {
        callId: 'call-1',
      })
    ).toBe(
      'https://www.yosemitecrew.com/appointments?action=telehealth&provider=getstream&callId=call-1'
    );
  });

  test('builds a deep link for native triggers', () => {
    expect(buildTelehealthDeepLink({ appointmentId: 'appt-123' })).toBe(
      'yosemitecrew://appointments?action=telehealth&provider=getstream&callId=yc-appt-appt-123&appointmentId=appt-123'
    );
  });

  test('builds telehealth path with no IDs', () => {
    expect(buildTelehealthPath({})).toBe('/appointments?action=telehealth&provider=getstream');
  });

  test('builds telehealth URL with no IDs', () => {
    expect(buildTelehealthUrl('https://example.com')).toBe(
      'https://example.com/appointments?action=telehealth&provider=getstream'
    );
  });

  test('builds deep link with no IDs', () => {
    expect(buildTelehealthDeepLink({})).toBe(
      'yosemitecrew://appointments?action=telehealth&provider=getstream'
    );
  });

  test('resolveStreamCallId returns null when no IDs present', () => {
    expect(resolveStreamCallId({})).toBeNull();
  });

  test('resolveStreamCallId falls back to appointment-derived ID', () => {
    expect(resolveStreamCallId({ appointmentId: 'appt-123' })).toBe('yc-appt-appt-123');
  });
});
