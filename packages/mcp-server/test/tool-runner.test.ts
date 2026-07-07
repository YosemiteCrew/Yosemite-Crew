import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorResult, jsonResult, runTool } from '../src/tool-runner.js';
import { axiosError, networkError, okResponse } from './helpers.js';

function firstText(result: CallToolResult): string {
  const first = result.content[0];
  if (first.type !== 'text') {
    throw new Error(`expected text content, got ${first.type}`);
  }
  return first.text;
}

describe('jsonResult', () => {
  it('wraps the payload as pretty-printed JSON text content', () => {
    const result = jsonResult({ data: [{ id: 'a' }] });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(firstText(result))).toEqual({ data: [{ id: 'a' }] });
  });

  it('renders undefined payloads as null instead of invalid JSON', () => {
    const result = jsonResult(undefined);
    expect(firstText(result)).toBe('null');
  });
});

describe('errorResult', () => {
  it('flags the result as an error and renders actionable text', () => {
    const result = errorResult(
      axiosError(403, {
        message: 'Insufficient scope for this API key',
        code: 'insufficient_scope',
      }),
      'invoices:read'
    );
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("'invoices:read'");
  });
});

describe('runTool', () => {
  it('returns the response payload on success', async () => {
    const result = await runTool('patients:read', () =>
      Promise.resolve(okResponse({ data: { id: 'p1' } }) as never)
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(firstText(result))).toEqual({ data: { id: 'p1' } });
  });

  it('converts thrown API errors into isError results', async () => {
    const result = await runTool('patients:read', () =>
      Promise.reject(
        axiosError(401, { message: 'Invalid or expired API key', code: 'invalid_api_key' })
      )
    );
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('YC_API_KEY');
  });

  it('converts network failures into isError results', async () => {
    const result = await runTool(undefined, () => Promise.reject(networkError()));
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('Could not reach the Yosemite Crew API');
  });
});
