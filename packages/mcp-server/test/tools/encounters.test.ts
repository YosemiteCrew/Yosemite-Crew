import { z } from 'zod';
import { registerEncounterTools } from '../../src/tools/encounters.js';
import {
  SAMPLE_UUID,
  axiosError,
  createClientStub,
  createServerStub,
  networkError,
  okResponse,
} from '../helpers.js';

jest.mock('axios');

const CASE_UUID = '8a7b6c5d-4e3f-4a1b-8c9d-0e1f2a3b4c5d';

function setup() {
  const { server, tools } = createServerStub();
  const { client, get } = createClientStub();
  registerEncounterTools(server, client);
  return { tools, get };
}

describe('encounter tools', () => {
  it('registers both tools as read-only and documents the required scope', () => {
    const { tools } = setup();
    expect([...tools.keys()].sort()).toEqual(['get_encounter', 'list_encounters']);
    for (const tool of tools.values()) {
      expect(tool.config.annotations?.readOnlyHint).toBe(true);
      expect(tool.config.description).toContain('encounters:read');
    }
  });

  describe('list_encounters', () => {
    it('calls GET /v1/developer/encounters with only the provided filters', async () => {
      const { tools, get } = setup();
      const envelope = { data: [], pagination: { nextCursor: null, hasMore: false, limit: 50 } };
      get.mockResolvedValue(okResponse(envelope));

      const result = await tools.get('list_encounters')!.handler({
        limit: 50,
        status: 'in-progress',
        patientId: SAMPLE_UUID,
      });

      expect(get).toHaveBeenCalledWith('/v1/developer/encounters', {
        params: { limit: 50, status: 'in-progress', patientId: SAMPLE_UUID },
      });
      expect(JSON.parse(result.content[0].text)).toEqual(envelope);
    });

    it('forwards case and period date range filters', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: [], pagination: {} }));

      await tools.get('list_encounters')!.handler({
        limit: 20,
        caseId: CASE_UUID,
        dateFrom: '2026-06-01T00:00:00Z',
        dateTo: '2026-06-30T23:59:59Z',
      });

      expect(get).toHaveBeenCalledWith('/v1/developer/encounters', {
        params: {
          limit: 20,
          caseId: CASE_UUID,
          dateFrom: '2026-06-01T00:00:00Z',
          dateTo: '2026-06-30T23:59:59Z',
        },
      });
    });

    it('accepts free-form statuses but validates ids and dates', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('list_encounters')!.config.inputSchema!);
      expect(schema.parse({})).toEqual({ limit: 50 });
      expect(schema.safeParse({ status: 'planned' }).success).toBe(true);
      expect(schema.safeParse({ status: '' }).success).toBe(false);
      expect(schema.safeParse({ patientId: 'not-a-uuid' }).success).toBe(false);
      expect(schema.safeParse({ caseId: 'not-a-uuid' }).success).toBe(false);
      expect(schema.safeParse({ dateFrom: 'June 1st' }).success).toBe(false);
      expect(schema.safeParse({ patientId: SAMPLE_UUID, caseId: CASE_UUID }).success).toBe(true);
    });

    it('maps quota exhaustion to free-tier guidance', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(429, { message: 'Monthly API quota exceeded.', code: 'quota_exceeded' })
      );

      const result = await tools.get('list_encounters')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('free tier');
    });

    it('maps network failures to a reachability message', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(networkError());

      const result = await tools.get('list_encounters')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
    });
  });

  describe('get_encounter', () => {
    it('fetches one encounter by id', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: { id: SAMPLE_UUID, status: 'finished' } }));

      const result = await tools.get('get_encounter')!.handler({ id: SAMPLE_UUID });

      expect(get).toHaveBeenCalledWith(`/v1/developer/encounters/${SAMPLE_UUID}`);
      expect(JSON.parse(result.content[0].text)).toEqual({
        data: { id: SAMPLE_UUID, status: 'finished' },
      });
    });

    it('requires a UUID id', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('get_encounter')!.config.inputSchema!);
      expect(schema.safeParse({ id: 'encounter-1' }).success).toBe(false);
      expect(schema.safeParse({ id: SAMPLE_UUID }).success).toBe(true);
    });

    it('names the encounters:read scope on 403', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(403, {
          message: 'Insufficient scope for this API key',
          code: 'insufficient_scope',
        })
      );

      const result = await tools.get('get_encounter')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("'encounters:read'");
    });
  });
});
