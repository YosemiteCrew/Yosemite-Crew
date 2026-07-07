import { z } from 'zod';
import { registerInvoiceTools } from '../../src/tools/invoices.js';
import {
  SAMPLE_UUID,
  axiosError,
  createClientStub,
  createServerStub,
  networkError,
  okResponse,
} from '../helpers.js';

jest.mock('axios');

const APPOINTMENT_UUID = '8a7b6c5d-4e3f-4a1b-8c9d-0e1f2a3b4c5d';

function setup() {
  const { server, tools } = createServerStub();
  const { client, get } = createClientStub();
  registerInvoiceTools(server, client);
  return { tools, get };
}

describe('invoice tools', () => {
  it('registers both tools as read-only and documents the required scope', () => {
    const { tools } = setup();
    expect([...tools.keys()].sort()).toEqual(['get_invoice', 'list_invoices']);
    for (const tool of tools.values()) {
      expect(tool.config.annotations?.readOnlyHint).toBe(true);
      expect(tool.config.description).toContain('invoices:read');
    }
  });

  describe('list_invoices', () => {
    it('calls GET /v1/developer/invoices with only the provided filters', async () => {
      const { tools, get } = setup();
      const envelope = { data: [], pagination: { nextCursor: null, hasMore: false, limit: 50 } };
      get.mockResolvedValue(okResponse(envelope));

      const result = await tools.get('list_invoices')!.handler({ limit: 50, status: 'PAID' });

      expect(get).toHaveBeenCalledWith('/v1/developer/invoices', {
        params: { limit: 50, status: 'PAID' },
      });
      expect(JSON.parse(result.content[0].text)).toEqual(envelope);
    });

    it('forwards patient, appointment, and created date range filters', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: [], pagination: {} }));

      await tools.get('list_invoices')!.handler({
        limit: 10,
        patientId: SAMPLE_UUID,
        appointmentId: APPOINTMENT_UUID,
        dateFrom: '2026-07-01T00:00:00Z',
        dateTo: '2026-07-07T00:00:00Z',
      });

      expect(get).toHaveBeenCalledWith('/v1/developer/invoices', {
        params: {
          limit: 10,
          patientId: SAMPLE_UUID,
          appointmentId: APPOINTMENT_UUID,
          dateFrom: '2026-07-01T00:00:00Z',
          dateTo: '2026-07-07T00:00:00Z',
        },
      });
    });

    it('validates the status enum, ids, and limits', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('list_invoices')!.config.inputSchema!);
      expect(schema.parse({})).toEqual({ limit: 50 });
      for (const status of [
        'PENDING',
        'AWAITING_PAYMENT',
        'PAID',
        'FAILED',
        'CANCELLED',
        'REFUNDED',
      ]) {
        expect(schema.safeParse({ status }).success).toBe(true);
      }
      expect(schema.safeParse({ status: 'paid' }).success).toBe(false);
      expect(schema.safeParse({ patientId: 'not-a-uuid' }).success).toBe(false);
      expect(schema.safeParse({ appointmentId: 'not-a-uuid' }).success).toBe(false);
      expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    });

    it('reports the retry window when rate limited', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(
          429,
          { message: 'Rate limit exceeded for this API key.', code: 'rate_limited' },
          {
            'retry-after': '1',
          }
        )
      );

      const result = await tools.get('list_invoices')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Retry in 1 second(s)');
    });

    it('maps network failures to a reachability message', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(networkError());

      const result = await tools.get('list_invoices')!.handler({ limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Could not reach the Yosemite Crew API');
    });
  });

  describe('get_invoice', () => {
    it('fetches one invoice by id', async () => {
      const { tools, get } = setup();
      get.mockResolvedValue(okResponse({ data: { id: SAMPLE_UUID, status: 'PAID' } }));

      const result = await tools.get('get_invoice')!.handler({ id: SAMPLE_UUID });

      expect(get).toHaveBeenCalledWith(`/v1/developer/invoices/${SAMPLE_UUID}`);
      expect(JSON.parse(result.content[0].text)).toEqual({
        data: { id: SAMPLE_UUID, status: 'PAID' },
      });
    });

    it('requires a UUID id', () => {
      const { tools } = setup();
      const schema = z.object(tools.get('get_invoice')!.config.inputSchema!);
      expect(schema.safeParse({ id: 'invoice-1' }).success).toBe(false);
      expect(schema.safeParse({ id: SAMPLE_UUID }).success).toBe(true);
    });

    it('names the invoices:read scope on 403', async () => {
      const { tools, get } = setup();
      get.mockRejectedValue(
        axiosError(403, {
          message: 'Insufficient scope for this API key',
          code: 'insufficient_scope',
        })
      );

      const result = await tools.get('get_invoice')!.handler({ id: SAMPLE_UUID });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("'invoices:read'");
    });
  });
});
