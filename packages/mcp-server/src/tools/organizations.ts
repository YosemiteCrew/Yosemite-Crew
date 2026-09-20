import type { AxiosInstance } from 'axios';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../tool-runner.js';

/*
 * Discovery. Every other org-scoped tool needs an organisation id, and this is
 * the only way to learn one - the key does not carry a practice, so there is
 * nothing to fall back on. Registered first for that reason.
 */
export function registerOrganizationTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    'list_organizations',
    'List the veterinary practices this API key may read, with the role the key owner holds at each. Call this before any other tool: the organisation id it returns is the required input for them, and only practices with a currently active membership appear.',
    {},
    async () => runTool(undefined, () => client.get<unknown>('/v1/developer/organizations'))
  );
}
