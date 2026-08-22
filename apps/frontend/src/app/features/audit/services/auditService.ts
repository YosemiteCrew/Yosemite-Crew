import { AuditTrail } from '@/app/features/audit/types/audit';
import { http } from '@/app/services/http';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

// The audit trail is read via POST, so it bypasses the axios GET in-flight
// dedupe. Share one promise per id while a request is in flight so a double mount
// (React StrictMode in dev) or two consumers don't fire duplicate POSTs.
const inFlightByKey = new Map<string, Promise<AuditTrail[]>>();

/**
 * The tenant a request is authorized against is decided by the interceptor from
 * the CURRENT session and active organisation, not by anything in the key. Two
 * callers asking for the same appointment under different organisations are not
 * asking the same question, so the active organisation is part of the key -
 * otherwise the second caller is handed the first one's answer, from the
 * previous tenant.
 */
const scopedKey = (key: string) => `${useOrgStore.getState().primaryOrgId ?? 'no-org'}::${key}`;

/** Drops any in-flight audit reads. Called when the session is torn down. */
export const clearInFlightAuditRequests = () => {
  inFlightByKey.clear();
};

const dedupedAuditTrail = (
  rawKey: string,
  request: () => Promise<AuditTrail[]>
): Promise<AuditTrail[]> => {
  const key = scopedKey(rawKey);
  const existing = inFlightByKey.get(key);
  if (existing) return existing;
  const promise = request().finally(() => {
    inFlightByKey.delete(key);
  });
  inFlightByKey.set(key, promise);
  return promise;
};

export const getAppointmentAuditTrail = async (appointmentId: string): Promise<AuditTrail[]> => {
  if (!appointmentId) {
    throw new Error('Appointment ID missing');
  }
  return dedupedAuditTrail(`appointment:${appointmentId}`, async () => {
    try {
      const res = await http.post<{ entries: AuditTrail[] }>('/v1/audit-trail/appointment', {
        appointmentId,
      });
      return res.data.entries;
    } catch (err) {
      logger.error('Failed to load audit trail:', err);
      throw err;
    }
  });
};

export const getCompanionAuditTrail = async (companionId: string): Promise<AuditTrail[]> => {
  if (!companionId) {
    throw new Error('Companion ID missing');
  }
  return dedupedAuditTrail(`companion:${companionId}`, async () => {
    try {
      const res = await http.post<{ entries: AuditTrail[] }>('/v1/audit-trail/companion', {
        patientId: companionId,
      });
      return res.data.entries;
    } catch (err) {
      logger.error('Failed to load audit trail:', err);
      throw err;
    }
  });
};
