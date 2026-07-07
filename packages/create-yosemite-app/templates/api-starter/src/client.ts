// A small, dependency-free client for the Yosemite Crew Developer Data API v1.
//
// Auth: every request sends "Authorization: Bearer <api key>". The API also
// accepts an "X-API-Key" header; Authorization wins when both are present.
// A key is bound to one organisation and only ever sees that org's data.
//
// v1 is read-only: every endpoint is a GET under /v1/developer/*.
//
// Errors come back as { "message": "...", "code": "..." }:
//   400 invalid_request, 401 missing_api_key / invalid_api_key,
//   403 insufficient_scope, 404 not_found (also when the resource belongs
//   to another org), 429 rate_limited / quota_exceeded, 500 internal_error.
// Responses also carry X-RateLimit-Limit / -Remaining / -Reset headers for
// the per-key rate-limit window.

import type {
  Appointment,
  AppointmentDetail,
  AppointmentQuery,
  Encounter,
  EncounterQuery,
  Invoice,
  InvoiceDetail,
  InvoiceQuery,
  Organization,
  Page,
  Patient,
  PatientDetail,
  PatientQuery,
  Usage,
} from './types.js';

/**
 * Thrown for any non-2xx response. The two 429 codes need different
 * handling:
 * - "rate_limited": per-key burst limit; safe to retry after
 *   retryAfterSeconds (typically 1).
 * - "quota_exceeded": the monthly quota is spent; retrying will not help
 *   until the next billing period (or an upgraded plan). retryAfterSeconds
 *   holds the seconds left in the current UTC billing month.
 */
export class YosemiteApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    /** Parsed from the Retry-After header when the API sends one. */
    readonly retryAfterSeconds: number | null
  ) {
    super(message);
    this.name = 'YosemiteApiError';
  }
}

export interface YosemiteClientOptions {
  /** API key from the developer portal (/developers/api-keys). */
  apiKey: string;
  /** API origin, e.g. "http://localhost:3000". Defaults to localhost. */
  baseUrl?: string;
}

export class YosemiteClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: YosemiteClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  /** Scope: appointments:read. Sorted by appointmentDate descending. */
  listAppointments(query: AppointmentQuery = {}): Promise<Page<Appointment>> {
    return this.list('/v1/developer/appointments', { ...query });
  }

  /** Scope: appointments:read. 404 not_found if absent or another org's. */
  getAppointment(id: string): Promise<AppointmentDetail> {
    return this.single(`/v1/developer/appointments/${encodeURIComponent(id)}`);
  }

  /** Scope: patients:read. */
  listPatients(query: PatientQuery = {}): Promise<Page<Patient>> {
    return this.list('/v1/developer/patients', { ...query });
  }

  /** Scope: patients:read. */
  getPatient(id: string): Promise<PatientDetail> {
    return this.single(`/v1/developer/patients/${encodeURIComponent(id)}`);
  }

  /** Scope: encounters:read. Sorted by createdAt descending. */
  listEncounters(query: EncounterQuery = {}): Promise<Page<Encounter>> {
    return this.list('/v1/developer/encounters', { ...query });
  }

  /** Scope: encounters:read. */
  getEncounter(id: string): Promise<Encounter> {
    return this.single(`/v1/developer/encounters/${encodeURIComponent(id)}`);
  }

  /** Scope: invoices:read. Sorted by createdAt descending. */
  listInvoices(query: InvoiceQuery = {}): Promise<Page<Invoice>> {
    return this.list('/v1/developer/invoices', { ...query });
  }

  /** Scope: invoices:read. */
  getInvoice(id: string): Promise<InvoiceDetail> {
    return this.single(`/v1/developer/invoices/${encodeURIComponent(id)}`);
  }

  /** Scope: organization:read. Always the key's own organisation. */
  getOrganization(): Promise<Organization> {
    return this.single('/v1/developer/organization');
  }

  /** No scope required, and exempt from the monthly quota and its 429. */
  getUsage(): Promise<Usage> {
    return this.single('/v1/developer/usage');
  }

  /** List endpoints: the whole body is the { data, pagination } envelope. */
  private async list<T>(
    path: string,
    query: Record<string, string | number | undefined>
  ): Promise<Page<T>> {
    return (await this.request(path, query)) as Page<T>;
  }

  /** Single resources: unwrap the { data } envelope. */
  private async single<T>(path: string): Promise<T> {
    const body = (await this.request(path)) as { data: T };
    return body.data;
  }

  private async request(
    path: string,
    query?: Record<string, string | number | undefined>
  ): Promise<unknown> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        message?: string;
        code?: string;
      } | null;
      const retryAfter = response.headers.get('Retry-After');
      throw new YosemiteApiError(
        details?.message ?? `Request failed with HTTP ${response.status}`,
        response.status,
        details?.code ?? 'unknown',
        retryAfter === null ? null : Number(retryAfter)
      );
    }

    return response.json();
  }
}
