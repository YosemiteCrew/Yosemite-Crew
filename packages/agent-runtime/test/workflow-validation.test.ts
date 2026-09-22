import { createAppointmentBriefingWorkflow } from '../src/index.js';
import { appointmentSource } from './fixtures.js';

const workflow = createAppointmentBriefingWorkflow(async () => [appointmentSource]);

const section = (overrides: Record<string, unknown> = {}) => ({
  heading: 'Visit',
  state: 'known',
  body: 'a synthetic line',
  sources: [appointmentSource],
  ...overrides,
});

const rejects = (output: unknown, detail: string): void => {
  expect(() => workflow.validateResult(output)).toThrow(
    expect.objectContaining({
      code: 'malformed-output',
      message: expect.stringContaining(detail),
    })
  );
};

describe('appointment briefing result contract', () => {
  it('accepts a source-linked briefing', () => {
    const result = workflow.validateResult({
      appointmentId: 'appt-1',
      sections: [section(), section({ state: 'unknown', body: null, sources: [] })],
    });

    expect(result.sections).toHaveLength(2);
    expect(result.sections[1]).toEqual({
      heading: 'Visit',
      state: 'unknown',
      body: null,
      sources: [],
    });
  });

  it.each([
    ['a bare string', 'result is not an object', 'not a briefing'],
    ['an array', 'result is not an object', []],
    ['no appointment id', 'result has no appointmentId', { sections: [section()] }],
    [
      'a blank appointment id',
      'result has no appointmentId',
      { appointmentId: '  ', sections: [section()] },
    ],
    ['no sections', 'result has no sections', { appointmentId: 'appt-1' }],
    ['an empty section list', 'result has no sections', { appointmentId: 'appt-1', sections: [] }],
  ])('rejects %s', (_name, detail, output) => {
    rejects(output, detail as string);
  });

  it.each([
    ['a non-object section', 'is not an object', 'section'],
    ['a section with no heading', 'has no heading', section({ heading: '   ' })],
    ['an unrecognised state', 'unrecognised state', section({ state: 'probably' })],
    ['a non-text body', 'body must be text or null', section({ body: 42 })],
    ['a missing source list', 'has no source list', section({ sources: undefined })],
    [
      'a finding with no source',
      'states a finding with no source',
      section({ state: 'known', sources: [] }),
    ],
    ['a non-object source', 'source is not an object', section({ sources: ['appointment/1'] })],
    [
      'a source with no version',
      'source is missing kind, id or version',
      section({ sources: [{ kind: 'appointment', id: 'appt-1' }] }),
    ],
  ])('rejects %s', (_name, detail, badSection) => {
    rejects({ appointmentId: 'appt-1', sections: [badSection] }, detail as string);
  });

  it('treats an absent body as null rather than as a finding', () => {
    const result = workflow.validateResult({
      appointmentId: 'appt-1',
      sections: [section({ state: 'not-applicable', body: null, sources: [] })],
    });

    expect(result.sections[0].body).toBeNull();
    expect(result.sections[0].state).toBe('not-applicable');
  });
});
