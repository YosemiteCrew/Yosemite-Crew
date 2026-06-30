import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './client.js';
import { registerAppointmentTools } from './tools/appointments.js';
import { registerPatientTools } from './tools/patients.js';

const server = new McpServer({
  name: 'yosemite-crew',
  version: '0.1.0',
});

const client = createApiClient();

registerAppointmentTools(server, client);
registerPatientTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
