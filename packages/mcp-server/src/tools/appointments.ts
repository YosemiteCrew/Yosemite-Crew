import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { compactParams, cursorParam, isoDateTimeParam, limitParam, uuidParam } from '../params.js';
import { runTool } from '../tool-runner.js';

const SCOPE = 'appointments:read';

const APPOINTMENT_STATUSES = [
  'REQUESTED',
  'UPCOMING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export function registerAppointmentTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'list_appointments',
    {
      description:
        "List the organisation's appointments, sorted by appointment date descending. Filter by status or appointment date range. Requires the appointments:read scope.",
      inputSchema: {
        limit: limitParam,
        cursor: cursorParam,
        status: z.enum(APPOINTMENT_STATUSES).optional().describe('Filter by appointment status'),
        dateFrom: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include appointments with appointmentDate on or after this instant'
        ),
        dateTo: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include appointments with appointmentDate on or before this instant'
        ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor, status, dateFrom, dateTo }) =>
      runTool(SCOPE, () =>
        client.get<unknown>('/v1/developer/appointments', {
          params: compactParams({ limit, cursor, status, dateFrom, dateTo }),
        })
      )
  );

  server.registerTool(
    'get_appointment',
    {
      description:
        'Get full details for one appointment by ID, including support staff, attachments, form IDs, and linked case/encounter. Requires the appointments:read scope.',
      inputSchema: {
        id: uuidParam('The appointment ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => runTool(SCOPE, () => client.get<unknown>(`/v1/developer/appointments/${id}`))
  );
}
