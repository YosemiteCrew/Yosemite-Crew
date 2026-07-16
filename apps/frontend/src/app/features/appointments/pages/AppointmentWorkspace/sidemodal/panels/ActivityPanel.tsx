'use client';
import React from 'react';
import { IoReaderOutline } from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';
import type { AuditTrail } from '@/app/features/audit/types/audit';
import { useAppointmentAuditTrail } from '@/app/features/audit/hooks/useAppointmentAuditTrail';
import { toTitle } from '@/app/lib/validators';
import { formatDateTimeLocal } from '@/app/lib/date';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';

type ActivityPanelProps = {
  appointment: Appointment;
};

const ACTOR_TYPE_LABELS: Record<string, string> = {
  PMS_USER: 'Team member',
  PARENT: 'Pet parent',
  SYSTEM: 'System',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  COMPANION_ORGANISATION: 'Companion profile',
  APPOINTMENT: 'Appointment',
  INVOICE: 'Finance',
  DOCUMENT: 'Document',
  FORM: 'Template',
};

/** Bold actor name for the event line — falls back to the actor-type label. */
const getActorName = (entry: AuditTrail): string => {
  const actorName = String(entry.actorName ?? '').trim();
  if (actorName) return actorName;
  const actorType = String(entry.actorType ?? '')
    .trim()
    .toUpperCase();
  return ACTOR_TYPE_LABELS[actorType] || toTitle(actorType || 'SYSTEM');
};

/** Muted entity label for the detail line (empty when there is no entity). */
const getEntityLabel = (entityType?: string | null): string => {
  const normalized = String(entityType ?? '')
    .trim()
    .toUpperCase();
  if (!normalized) return '';
  return ENTITY_TYPE_LABELS[normalized] || toTitle(normalized);
};

/**
 * Activity panel — a vertical timeline of the appointment's audit trail.
 * Hosted inside the QuickActions modal, which already renders the header/close
 * chrome, so this renders only the timeline body.
 */
const ActivityPanel = ({ appointment }: ActivityPanelProps) => {
  const appointmentId = appointment.id;
  const entries = useAppointmentAuditTrail(appointmentId);

  return (
    <PermissionGate allOf={[PERMISSIONS.AUDIT_VIEW_ANY]} fallback={<Fallback />}>
      <div className="w-full">
        {entries.length === 0 ? (
          <div className="w-full flex items-center justify-center text-body-4 text-text-primary">
            Nothing to show
          </div>
        ) : (
          <ol className="w-full flex flex-col">
            {entries.map((entry, index) => {
              const isLast = index === entries.length - 1;
              const entityLabel = getEntityLabel(entry.entityType);
              const timestamp = formatDateTimeLocal(entry.occurredAt, '—');
              return (
                <li
                  key={entry.id ?? `${entry.eventType}-${String(entry.occurredAt)}-${index}`}
                  className="flex gap-3 font-satoshi"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-text-brand">
                      <IoReaderOutline size={12} aria-hidden />
                    </span>
                    {!isLast ? <span className="w-px flex-1 bg-card-border" /> : null}
                  </div>
                  <div className={isLast ? 'min-w-0' : 'min-w-0 pb-3.5'}>
                    <p className="text-body-4 text-text-secondary">
                      <span className="font-bold text-text-primary">{getActorName(entry)}</span>{' '}
                      {toTitle(entry.eventType)}
                    </p>
                    <p className="mt-0.5 text-caption-2 text-text-tertiary">
                      {entityLabel ? `${entityLabel} · ${timestamp}` : timestamp}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </PermissionGate>
  );
};

export default ActivityPanel;
