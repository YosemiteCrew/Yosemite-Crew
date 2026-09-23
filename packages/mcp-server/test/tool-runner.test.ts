import { errorResult, jsonResult, runTool } from '../src/tool-runner.js';
import { axiosFailure } from './helpers.js';

describe('jsonResult', () => {
  it('renders the payload as pretty JSON text', () => {
    expect(jsonResult({ a: 1 }).content[0]).toEqual({ type: 'text', text: '{\n  "a": 1\n}' });
  });

  it('renders an absent payload as null rather than undefined', () => {
    expect((jsonResult(undefined).content[0] as { text: string }).text).toBe('null');
  });
});

describe('errorResult', () => {
  it('marks the result as an error', () => {
    expect(errorResult(new Error('x')).isError).toBe(true);
  });
});

describe('runTool', () => {
  it('returns the response body on success', async () => {
    const result = await runTool(undefined, async () => ({ data: { ok: true } }) as never);
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).toContain('"ok": true');
  });

  /*
   * A failure comes back as isError content, not a thrown error: an agent can
   * read the text and correct itself, whereas a throw ends the turn.
   */
  it('converts a failure into readable content instead of throwing', async () => {
    const result = await runTool('appointments:read', async () => {
      throw axiosFailure(403, { message: 'Insufficient scope for this API key' });
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('appointments:read');
  });
});
