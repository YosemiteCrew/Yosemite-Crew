import { AuditTrail } from '@/app/features/audit/types/audit';
import { http } from '@/app/services/http';
import { logger } from '@/app/lib/logger';

export const getAppointmentAuditTrail = async (appointmentId: string): Promise<AuditTrail[]> => {
  try {
    if (!appointmentId) {
      throw new Error('Appointment ID missing');
    }
    const res = await http.post<{ entries: AuditTrail[] }>('/v1/audit-trail/appointment', {
      appointmentId,
    });
    return res.data.entries;
  } catch (err) {
    logger.error('Failed to load audit trail:', err);
    throw err;
  }
};

export const getCompanionAuditTrail = async (companionId: string): Promise<AuditTrail[]> => {
  try {
    if (!companionId) {
      throw new Error('CompanionId ID missing');
    }
    const res = await http.post<{ entries: AuditTrail[] }>('/v1/audit-trail/companion', {
      companionId,
    });
    return res.data.entries;
  } catch (err) {
    logger.error('Failed to load audit trail:', err);
    throw err;
  }
};
