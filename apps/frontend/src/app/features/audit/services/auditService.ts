import { AuditTrail } from '@/app/features/audit/types/audit';
import { http } from '@/app/services/http';
import { logger } from '@/app/lib/logger';

// The audit trail is read via POST, so it bypasses the axios GET in-flight
// dedupe. Share one promise per id while a request is in flight so a double mount
// (React StrictMode in dev) or two consumers don't fire duplicate POSTs.
const inFlightByKey = new Map<string, Promise<AuditTrail[]>>();

const dedupedAuditTrail = (
  key: string,
  request: () => Promise<AuditTrail[]>
): Promise<AuditTrail[]> => {
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
