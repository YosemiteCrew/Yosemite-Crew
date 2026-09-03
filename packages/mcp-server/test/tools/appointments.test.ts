import { registerAppointmentTools } from '../../src/tools/appointments.js';
import { fakeClient, fakeServer, axiosFailure } from '../helpers.js';

const setup = (impl?: Parameters<typeof fakeClient>[0]) => {
  const { client, calls } = fakeClient(impl);
  const { server, tools } = fakeServer();
  registerAppointmentTools(server, client);
  return { calls, tools, byName: (n: string) => tools.find((t) => t.name === n)! };
};

describe('appointment tools', () => {
  it('registers both read tools', () => {
    expect(setup().tools.map((t) => t.name)).toEqual(['list_appointments', 'get_appointment']);
  });

  it('requires an organisation on both tools, since the key carries none', () => {
    const { tools } = setup();
    for (const tool of tools) {
      expect(Object.keys(tool.schema)).toContain('organisationId');
    }
  });

  it('sends the organisation as x-org-id, not as a query parameter', async () => {
    const { byName, calls } = setup();
    await byName('list_appointments').handler({ organisationId: 'org-a' } as never);
    expect(calls[0].url).toBe('/v1/developer/appointments');
    expect(calls[0].config).toMatchObject({ headers: { 'x-org-id': 'org-a' } });
    expect(JSON.stringify((calls[0].config as { params: unknown }).params)).not.toContain('org-a');
  });

  it('omits filters that were not supplied', async () => {
    const { byName, calls } = setup();
    await byName('list_appointments').handler({ organisationId: 'org-a' } as never);
    expect((calls[0].config as { params: object }).params).toEqual({});
  });

  it('passes the filters that were supplied', async () => {
    const { byName, calls } = setup();
    await byName('list_appointments').handler({
      organisationId: 'org-a',
      from: '2026-09-01T00:00:00Z',
      status: 'UPCOMING',
      limit: 10,
      cursor: 'abc',
    } as never);
    expect((calls[0].config as { params: object }).params).toEqual({
      from: '2026-09-01T00:00:00Z',
      status: 'UPCOMING',
      limit: 10,
      cursor: 'abc',
    });
  });

  /*
   * An id is caller-supplied and goes into the path. Without encoding, an id
   * containing a slash or a dot-segment addresses a different route.
   */
  it('encodes the appointment id into the path', async () => {
    const { byName, calls } = setup();
    await byName('get_appointment').handler({
      organisationId: 'org-a',
      appointmentId: '../usage',
    } as never);
    expect(calls[0].url).toBe('/v1/developer/appointments/..%2Fusage');
  });

  it('reports a scope failure with the scope it needed', async () => {
    const { byName } = setup(async () => {
      throw axiosFailure(403, { message: 'Insufficient scope for this API key' });
    });
    const result = await byName('get_appointment').handler({
      organisationId: 'org-a',
      appointmentId: 'a1',
    } as never);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('appointments:read');
  });
});
