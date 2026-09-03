import type { AxiosInstance } from 'axios';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { orgHeaders } from '../client.js';
import { compactParams, cursorParam, limitParam, organisationIdParam } from '../params.js';
import { runTool } from '../tool-runner.js';

const SCOPE = 'appointments:read';

const STATUSES = [
  'REQUESTED',
  'UPCOMING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export function registerAppointmentTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    'list_appointments',
    'List appointments for one practice, oldest first, with optional date-window and status filters. Results are paginated: when the response carries pagination.nextCursor there are more, and that value is the cursor for the next call.',
    {
      organisationId: organisationIdParam,
      from: z
        .string()
        .optional()
        .describe('Only appointments on or after this ISO 8601 date-time.'),
      to: z.string().optional().describe('Only appointments on or before this ISO 8601 date-time.'),
      status: z.enum(STATUSES).optional().describe('Only appointments in this status.'),
      limit: limitParam,
      cursor: cursorParam,
    },
    async ({ organisationId, from, to, status, limit, cursor }) =>
      runTool(SCOPE, () =>
        client.get<unknown>('/v1/developer/appointments', {
          params: compactParams({ from, to, status, limit, cursor }),
          ...orgHeaders(organisationId),
        })
      )
  );

  server.tool(
    'get_appointment',
    'Fetch one appointment by id, including the patient snapshot, lead clinician, room, timing and status. Returns not-found if the appointment belongs to a practice this key cannot read.',
    {
      organisationId: organisationIdParam,
      appointmentId: z
        .string()
        .min(1)
        .describe('The appointment id, as returned by list_appointments.'),
    },
    async ({ organisationId, appointmentId }) =>
      runTool(SCOPE, () =>
        client.get<unknown>(
          `/v1/developer/appointments/${encodeURIComponent(appointmentId)}`,
          orgHeaders(organisationId)
        )
      )
  );
}
