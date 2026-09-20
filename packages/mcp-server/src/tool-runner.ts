import type { AxiosResponse } from 'axios';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describeToolError } from './errors.js';

/** Wrap a successful API payload as MCP text content. */
export function jsonResult(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload ?? null, null, 2) }] };
}

/** Wrap a failure as an MCP isError result with actionable text. */
export function errorResult(err: unknown, requiredScope?: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: describeToolError(err, requiredScope) }],
  };
}

/**
 * Run one data-plane request and convert either outcome into a tool result.
 *
 * A failure is returned as `isError` content rather than thrown: an agent can
 * read the text and correct itself, whereas a thrown error ends the turn.
 * `requiredScope` only makes 403s specific.
 */
export async function runTool(
  requiredScope: string | undefined,
  request: () => Promise<AxiosResponse<unknown>>
): Promise<CallToolResult> {
  try {
    const response = await request();
    return jsonResult(response.data);
  } catch (err) {
    return errorResult(err, requiredScope);
  }
}
