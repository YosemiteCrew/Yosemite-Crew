import { z } from 'zod';
import { registerPatientTools } from '../../src/tools/patients.js';
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
  registerPatientTools(server, client);
  return { tools, get };
}

describe('patient tools', () => {
  it('registers both tools as read-only and documents the required scope', () => {
    const { tools } = setup();
    expect([...tools.keys()].sort()).toEqual(['get_patient', 'list_patients']);
    for (const tool of tools.values()) {
      expect(tool.config.annotations?.readOnlyHint).toBe(true);
      expect(tool.config.description).toContain('patients:read');
    }
  });

  describe('list_patients', () => {
    it('calls GET /v1/developer/patients with only the provided filters', async () => {
      const { tools, get } = setup();
      const envelope = {
        data: [{ id: SAMPLE_UUID, name: 'Biscuit' }],
        pagination: { nextCursor: 'abc', hasMore: true, limit: 10 },
      };
      get.mockResolvedValue(okResponse(envelope));

      const result = await tools.get('list_patients')!.handler({ limit: 10, status: 'active' });

      expect(get).toHaveBeenCalledWith('/v1/developer/patients', {
        params: { limit: 10, status: 'active' },
      });
      expect(JSON.parse(result.content[0].text)).toEqual(envelope);
    });

    it('forwards the pagination cursor', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: [], pagination: {} }));

      await tools.get('list_patients')!.handler({ limit: 50, cursor: 'eyJpZCI6InAxIn0' });

      expect(get).toHaveBeenCalledWith('/v1/developer/patients', {
        params: { limit: 50, cursor: 'eyJpZCI6InAxIn0' },
      });
    });

    it('applies the default limit and validates the status enum', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('list_patients')!.config.inputSchema!);
      expect(schema.parse({})).toEqual({ limit: 50 });
      expect(schema.safeParse({ status: 'active' }).success).toBe(true);
      expect(schema.safeParse({ status: 'archived' }).success).toBe(true);
      expect(schema.safeParse({ status: 'inactive' }).success).toBe(true);
      expect(schema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
      expect(schema.safeParse({ limit: 500 }).success).toBe(false);
    });

    it('maps quota exhaustion to free-tier guidance', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(429, { message: 'Monthly API quota exceeded.', code: 'quota_exceeded' })
      );

      const result = await tools.get('list_patients')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('free tier');
    });

    it('maps network failures to a reachability message', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(networkError());

      const result = await tools.get('list_patients')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
    });
  });

  describe('get_patient', () => {
    it('fetches one patient by id', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: { id: SAMPLE_UUID, name: 'Biscuit' } }));

      const result = await tools.get('get_patient')!.handler({ id: SAMPLE_UUID });

      expect(get).toHaveBeenCalledWith(`/v1/developer/patients/${SAMPLE_UUID}`);
      expect(JSON.parse(result.content[0].text)).toEqual({
        data: { id: SAMPLE_UUID, name: 'Biscuit' },
      });
    });

    it('requires a UUID id', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('get_patient')!.config.inputSchema!);
      expect(schema.safeParse({ id: 'patient-1' }).success).toBe(false);
      expect(schema.safeParse({ id: SAMPLE_UUID }).success).toBe(true);
    });

    it('reports org-scoped 404s (no ACTIVE PatientOrganisation link)', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(axiosError(404, { message: 'Not found', code: 'not_found' }));

      const result = await tools.get('get_patient')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('different organisation');
    });

    it('names the patients:read scope on 403', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(403, {
          message: 'Insufficient scope for this API key',
          code: 'insufficient_scope',
        })
      );

      const result = await tools.get('get_patient')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("'patients:read'");
    });
  });
});
