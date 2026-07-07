import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { runTool } from '../tool-runner.js';

export function registerUsageTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'get_usage',
    {
      description:
        'Get API usage for the current billing period: billing period, call count, and monthly limit (null on pro/enterprise; the free tier allows 1000 calls per month). Works with any valid key, requires no scope, and does not consume quota.',
      annotations: { readOnlyHint: true },
    },
    async () => runTool(undefined, () => client.get<unknown>('/v1/developer/usage'))
  );
}
