import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AxiosInstance } from 'axios';

export function registerAppointmentTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    'list_appointments',
    'List upcoming and past appointments for your organisation. Filter by status or date range.',
    {
      status: z
        .enum([
          'REQUESTED',
          'UPCOMING',
          'CHECKED_IN',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'NO_SHOW',
        ])
        .optional()
        .describe('Filter by appointment status'),
      dateFrom: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('ISO 8601 start of date range (inclusive)'),
      dateTo: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('ISO 8601 end of date range (inclusive)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe('Maximum number of results to return (1-100)'),
    },
    async ({ status, dateFrom, dateTo, limit }) => {
      const params: Record<string, unknown> = { limit };
      if (status) params.status = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await client.get('/v1/api/appointments', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_appointment',
    'Get full details for a specific appointment by ID.',
    {
      id: z.string().uuid().describe('The appointment ID'),
    },
    async ({ id }) => {
      const response = await client.get(`/v1/api/appointments/${id}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );
}
