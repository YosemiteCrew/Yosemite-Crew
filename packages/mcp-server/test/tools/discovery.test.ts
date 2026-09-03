import { registerOrganizationTools } from '../../src/tools/organizations.js';
import { registerUsageTools } from '../../src/tools/usage.js';
import { fakeClient, fakeServer } from '../helpers.js';

describe('list_organizations', () => {
  it('takes no arguments, because it is how an organisation is discovered', async () => {
    const { client, calls } = fakeClient();
    const { server, tools } = fakeServer();
    registerOrganizationTools(server, client);

    expect(tools).toHaveLength(1);
    expect(tools[0].schema).toEqual({});
    await tools[0].handler({} as never);
    expect(calls[0].url).toBe('/v1/developer/organizations');
    // No x-org-id: requiring one would make discovery impossible.
    expect(calls[0].config).toBeUndefined();
  });

  it('tells the agent to call it first', () => {
    const { server, tools } = fakeServer();
    registerOrganizationTools(server, fakeClient().client);
    expect(tools[0].description).toContain('before any other tool');
  });
});

describe('get_usage', () => {
  it('reads the developer-scoped usage route with no organisation', async () => {
    const { client, calls } = fakeClient();
    const { server, tools } = fakeServer();
    registerUsageTools(server, client);

    await tools[0].handler({} as never);
    expect(tools[0].schema).toEqual({});
    expect(calls[0].url).toBe('/v1/developer/usage');
    expect(calls[0].config).toBeUndefined();
  });
});
