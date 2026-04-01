import React, { useEffect, useMemo, useState } from 'react';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Appointment } from '@yosemite-crew/types';
import { AuditTrail } from '@/app/features/audit/types/audit';
import { getAppointmentAuditTrail } from '@/app/features/audit/services/auditService';
import { toTitle } from '@/app/lib/validators';
import { formatDateTimeLocal } from '@/app/lib/date';
import { Badge, Card } from '@/app/ui';

type AuditProps = {
  activeAppointment: Appointment;
};

const getAuditActorDisplay = (entry: AuditTrail): string => {
  const actorType = String(entry.actorType ?? '')
    .trim()
    .toUpperCase();
  const actorTypeLabelMap: Record<string, string> = {
    PMS_USER: 'Team member',
    PARENT: 'Pet parent',
    SYSTEM: 'System',
  };
  const actorTypeLabel = actorTypeLabelMap[actorType] || toTitle(actorType || 'SYSTEM');
  const actorName = String(entry.actorName ?? '').trim();
  if (actorName) {
    return `${actorName} • ${actorTypeLabel}`;
  }
  return actorTypeLabel;
};

const getAuditEntityLabel = (entityType?: string | null): string => {
  const normalized = String(entityType ?? '')
    .trim()
    .toUpperCase();
  const entityTypeLabelMap: Record<string, string> = {
    COMPANION_ORGANISATION: 'Companion profile',
    APPOINTMENT: 'Appointment',
    INVOICE: 'Finance',
    DOCUMENT: 'Document',
    FORM: 'Template',
  };
  return entityTypeLabelMap[normalized] || toTitle(normalized);
};

const getAuditEntityTone = (
  entityType?: string | null
): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' => {
  const normalized = String(entityType ?? '')
    .trim()
    .toUpperCase();
  if (normalized === 'APPOINTMENT') return 'brand';
  if (normalized === 'INVOICE') return 'success';
  if (normalized === 'DOCUMENT') return 'warning';
  return 'neutral';
};

const Audit = ({ activeAppointment }: AuditProps) => {
  const appointmentId = useMemo(() => {
    return activeAppointment.id;
  }, [activeAppointment]);

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

  return (
    <PermissionGate allOf={[PERMISSIONS.AUDIT_VIEW_ANY]} fallback={<Fallback />}>
      <div className="w-full">
        {entries.length === 0 ? (
          <div className="w-full flex items-center justify-center text-body-4 text-text-primary">
            Nothing to show
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-1.5">
            {entries.map((e, idx) => (
              <Card
                key={e.id ?? `${e.eventType}-${e.occurredAt}-${idx}`}
                variant="default"
                className="w-full font-satoshi px-3 py-2.5"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 truncate text-body-4-emphasis text-text-primary">
                      {toTitle(e.eventType)}
                    </div>
                    {e.entityType ? (
                      <Badge
                        tone={getAuditEntityTone(e.entityType)}
                        className="px-2 py-0.5 text-caption-1"
                      >
                        {getAuditEntityLabel(e.entityType)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-end justify-between gap-2">
                    <div className="truncate text-caption-1 text-text-secondary">
                      Updated by: {getAuditActorDisplay(e)}
                    </div>
                    <div className="shrink-0 text-caption-1 text-text-secondary md:whitespace-nowrap">
                      {formatDateTimeLocal(e.occurredAt, '—')}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
};

export default Audit;
