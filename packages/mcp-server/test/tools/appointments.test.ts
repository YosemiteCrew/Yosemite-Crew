import { z } from 'zod';
import { registerAppointmentTools } from '../../src/tools/appointments.js';
import {
  SAMPLE_UUID,
  axiosError,
  createClientStub,
  createServerStub,
  networkError,
  okResponse,
} from '../helpers.js';

jest.mock('axios');

function setup() {
  const { server, tools } = createServerStub();
  const { client, get } = createClientStub();
  registerAppointmentTools(server, client);
  return { tools, get };
}

describe('appointment tools', () => {
  it('registers both tools as read-only and documents the required scope', () => {
    const { tools } = setup();
    expect([...tools.keys()].sort()).toEqual(['get_appointment', 'list_appointments']);
    for (const tool of tools.values()) {
      expect(tool.config.annotations?.readOnlyHint).toBe(true);
      expect(tool.config.description).toContain('appointments:read');
    }
  });

  describe('list_appointments', () => {
    it('calls GET /v1/developer/appointments with only the provided filters', async () => {
      const { tools, get } = setup();
      const envelope = {
        data: [],
        pagination: { nextCursor: null, hasMore: false, limit: 50 },
      };
      get.mockResolvedValue(okResponse(envelope));

      const result = await tools
        .get('list_appointments')!
        .handler({ limit: 50, status: 'UPCOMING' });

      expect(get).toHaveBeenCalledWith('/v1/developer/appointments', {
        params: { limit: 50, status: 'UPCOMING' },
      });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(envelope);
    });

    it('forwards cursor and date range filters', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: [], pagination: {} }));

      await tools.get('list_appointments')!.handler({
        limit: 25,
        cursor: 'eyJpZCI6IjljMWUifQ',
        dateFrom: '2026-07-01T00:00:00+00:00',
        dateTo: '2026-07-31T23:59:59+00:00',
      });

      expect(get).toHaveBeenCalledWith('/v1/developer/appointments', {
        params: {
          limit: 25,
          cursor: 'eyJpZCI6IjljMWUifQ',
          dateFrom: '2026-07-01T00:00:00+00:00',
          dateTo: '2026-07-31T23:59:59+00:00',
        },
      });
    });

    it('applies the documented default limit through the schema', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('list_appointments')!.config.inputSchema!);
      expect(schema.parse({})).toEqual({ limit: 50 });
    });

    it('rejects invalid limits, statuses, cursors, and dates', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('list_appointments')!.config.inputSchema!);
      expect(schema.safeParse({ limit: 0 }).success).toBe(false);
      expect(schema.safeParse({ limit: 101 }).success).toBe(false);
      expect(schema.safeParse({ status: 'BOOKED' }).success).toBe(false);
      expect(schema.safeParse({ cursor: '' }).success).toBe(false);
      expect(schema.safeParse({ dateFrom: '2026-07-01' }).success).toBe(false);
      expect(schema.safeParse({ status: 'NO_SHOW', dateTo: '2026-07-01T00:00:00Z' }).success).toBe(
        true
      );
    });

    it('maps quota exhaustion to free-tier guidance', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(
          429,
          {
            message: 'Monthly API quota exceeded. Upgrade to Pro to continue.',
            code: 'quota_exceeded',
          },
          { 'retry-after': '2073600' }
        )
      );

      const result = await tools.get('list_appointments')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('1000');
      expect(result.content[0].text).toContain('free tier');
    });

    it('maps 401 responses to YC_API_KEY guidance', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(401, { message: 'Invalid or expired API key', code: 'invalid_api_key' })
      );

      const result = await tools.get('list_appointments')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('YC_API_KEY');
    });

    it('maps network failures to a reachability message', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(networkError());

      const result = await tools.get('list_appointments')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
    });
  });

  describe('get_appointment', () => {
    it('fetches one appointment by id', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: { id: SAMPLE_UUID, status: 'COMPLETED' } }));

      const result = await tools.get('get_appointment')!.handler({ id: SAMPLE_UUID });

      expect(get).toHaveBeenCalledWith(`/v1/developer/appointments/${SAMPLE_UUID}`);
      expect(JSON.parse(result.content[0].text)).toEqual({
        data: { id: SAMPLE_UUID, status: 'COMPLETED' },
      });
    });

    it('requires a UUID id', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('get_appointment')!.config.inputSchema!);
      expect(schema.safeParse({ id: 'appointment-1' }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ id: SAMPLE_UUID }).success).toBe(true);
    });

    it('reports org-scoped 404s', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(axiosError(404, { message: 'Not found', code: 'not_found' }));

      const result = await tools.get('get_appointment')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('different organisation');
    });

    it('names the appointments:read scope on 403', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(403, {
          message: 'Insufficient scope for this API key',
          code: 'insufficient_scope',
        })
      );

      const result = await tools.get('get_appointment')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("'appointments:read'");
    });
  });
});
