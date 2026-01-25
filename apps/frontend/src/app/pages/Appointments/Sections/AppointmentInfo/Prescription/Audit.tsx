import React, { useEffect, useMemo, useState } from "react";
import Fallback from "@/app/components/Fallback";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import { Appointment } from "@yosemite-crew/types";
import { AuditTrail } from "@/app/types/audit";
import { getAppointmentAuditTrail } from "@/app/services/audit";
import { toTitle } from "@/app/utils/validators";

type AuditProps = {
  activeAppointment: Appointment;
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
    <PermissionGate
      allOf={[PERMISSIONS.AUDIT_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="w-full">
        {entries.length === 0 ? (
          <div className="w-full flex items-center justify-center text-body-4 text-text-primary">
            Nothing to show
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="w-full rounded-2xl border border-card-border bg-white px-3 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="text-body-3 text-text-primary font-medium">
                      {toTitle(e.eventType)}
                    </div>

                    <div className="text-caption-1 text-text-secondary">
                      {toTitle(e.entityType)}
                    </div>

                    <div className="text-caption-1 text-text-secondary">
                      Actor: {toTitle(e.actorType)}
                      {e.actorName ? " - " + toTitle(e.actorName) : ""}
                    </div>
                  </div>

                  <div className="text-caption-1 text-text-secondary whitespace-nowrap">
                    {formatDateTime(e.occurredAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
};

export default Audit;

function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
