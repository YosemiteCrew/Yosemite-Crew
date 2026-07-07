import { registerUsageTools } from '../../src/tools/usage.js';
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
  registerUsageTools(server, client);
  return { tools, get };
}

describe('usage tools', () => {
  it('registers get_usage as a read-only, parameterless, scope-free tool', () => {
    const { tools } = setup();
    expect([...tools.keys()]).toEqual(['get_usage']);
    const tool = tools.get('get_usage')!;
    expect(tool.config.annotations?.readOnlyHint).toBe(true);
    expect(tool.config.description).toContain('no scope');
    expect(tool.config.description).toContain('does not consume quota');
    expect(tool.config.inputSchema).toBeUndefined();
  });

  it('fetches current billing period usage', async () => {
    const { tools, get } = setup();
    const envelope = { data: { billingPeriod: '2026-07', callCount: 412, limit: 1000 } };
    get.mockResolvedValue(okResponse(envelope));

    const result = await tools.get('get_usage')!.handler({});

    expect(get).toHaveBeenCalledWith('/v1/developer/usage');
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(envelope);
  });

  it('handles a null limit for pro and enterprise keys', async () => {
    const { tools, get } = setup();
    get.mockResolvedValue(
      okResponse({ data: { billingPeriod: '2026-07', callCount: 90210, limit: null } })
    );

    const result = await tools.get('get_usage')!.handler({});

    expect(JSON.parse(result.content[0].text)).toEqual({
      data: { billingPeriod: '2026-07', callCount: 90210, limit: null },
    });
  });

  it('maps 401 responses to YC_API_KEY guidance without a scope hint', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(
      axiosError(401, { message: 'Invalid or expired API key', code: 'invalid_api_key' })
    );

    const result = await tools.get('get_usage')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('YC_API_KEY');
  });

  it('never claims a scope requirement on 403', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(axiosError(403, { message: 'Forbidden', code: 'insufficient_scope' }));

    const result = await tools.get('get_usage')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Permission denied');
    expect(result.content[0].text).not.toContain("' scope");
  });

  it('maps network failures to a reachability message', async () => {
    const { tools, get } = setup();
    get.mockRejectedValue(networkError());

    const result = await tools.get('get_usage')!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
  });
});
