import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AxiosInstance } from 'axios';

export function registerPatientTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    'list_patients',
    'List patients (companion animals) linked to your organisation. Optionally filter by record status.',
    {
      status: z
        .enum(['active', 'archived', 'inactive'])
        .optional()
        .describe('Filter by patient record status'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe('Maximum number of results to return (1-100)'),
    },
    async ({ status, limit }) => {
      const params: Record<string, unknown> = { limit };
      if (status) params.status = status;

      const response = await client.get('/v1/api/patients', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_patient',
    'Get full details for a specific patient (companion animal) by ID.',
    {
      id: z.string().uuid().describe('The patient ID'),
    },
    async ({ id }) => {
      const response = await client.get(`/v1/api/patients/${id}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );
}
