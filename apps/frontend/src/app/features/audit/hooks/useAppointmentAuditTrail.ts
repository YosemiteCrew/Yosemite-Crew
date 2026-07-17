'use client';
import { useEffect, useState } from 'react';
import type { AuditTrail } from '@/app/features/audit/types/audit';
import { getAppointmentAuditTrail } from '@/app/features/audit/services/auditService';

/**
 * Loads an appointment's audit trail, resetting to an empty list when there is
 * no appointment or the request fails. The in-flight request is cancelled on
 * unmount (and when the appointment changes) so a late response cannot write to
 * an unmounted component.
 *
 * Shared by the workspace Activity panel and the prescription Audit card, which
 * render the same data very differently.
 */
export const useAppointmentAuditTrail = (appointmentId?: string): AuditTrail[] => {
  const [entries, setEntries] = useState<AuditTrail[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!appointmentId) {
        setEntries([]);
        return;
      }
      try {
        const data = await getAppointmentAuditTrail(appointmentId);
        if (!cancelled) setEntries(data ?? []);
      } catch {
        if (!cancelled) setEntries([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  return entries;
};
