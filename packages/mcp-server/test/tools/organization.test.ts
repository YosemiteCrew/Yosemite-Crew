import { registerOrganizationTools } from '../../src/tools/organization.js';
import {
  axiosError,
  createClientStub,
  createServerStub,
  networkError,
  okResponse,
} from '../helpers.js';

jest.mock('axios');

function setup() {
  const { server, tools } = createServerStub();
  const { client, get } = createClientStub();
  registerOrganizationTools(server, client);
  return { tools, get };
}

describe('organization tools', () => {
  it('registers get_organization as a read-only, parameterless tool', () => {
    const { tools } = setup();
    expect([...tools.keys()]).toEqual(['get_organization']);
    const tool = tools.get('get_organization')!;
    expect(tool.config.annotations?.readOnlyHint).toBe(true);
    expect(tool.config.description).toContain('organization:read');
    expect(tool.config.inputSchema).toBeUndefined();
  });

  it("fetches the key's own organisation profile", async () => {
    const { tools, get } = setup();
    const envelope = {
      data: { id: 'org-1', name: 'Happy Paws Clinic', address: { city: 'Berlin' } },
    };
    get.mockResolvedValue(okResponse(envelope));

    const result = await tools.get('get_organization')!.handler({});

    expect(get).toHaveBeenCalledWith('/v1/developer/organization');
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(envelope);
  });

  it('names the organization:read scope on 403', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(
      axiosError(403, {
        message: 'Insufficient scope for this API key',
        code: 'insufficient_scope',
      })
    );

    const result = await tools.get('get_organization')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'organization:read'");
  });

  it('maps 401 responses to YC_API_KEY guidance', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(
      axiosError(401, { message: 'Invalid or expired API key', code: 'invalid_api_key' })
    );

    const result = await tools.get('get_organization')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('YC_API_KEY');
  });

  it('maps network failures to a reachability message', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(networkError());

    const result = await tools.get('get_organization')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
  });
});
