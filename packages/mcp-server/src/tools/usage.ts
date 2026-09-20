import type { AxiosInstance } from 'axios';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../tool-runner.js';

export function registerUsageTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    'get_usage',
    "Report this API key owner's call count and monthly quota for the current billing period. Needs no organisation and consumes no scope. Test-environment keys are never metered, so they report a count of zero.",
    {},
    async () => runTool(undefined, () => client.get<unknown>('/v1/developer/usage'))
  );
}
