import React, { useMemo } from "react";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import Fallback from "@/app/ui/overlays/Fallback";
import { PERMISSIONS } from "@/app/lib/permissions";
import { useAppointmentsForCompanionInPrimaryOrg } from "@/app/hooks/useAppointments";
import AppointmentCardContent from "@/app/features/appointments/components/AppointmentCardContent";

type AppointmentHistoryListProps = {
  companionId: string;
};

const AppointmentHistoryList = ({ companionId }: AppointmentHistoryListProps) => {
  const appointments = useAppointmentsForCompanionInPrimaryOrg(companionId);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime(),
    );
  }, [appointments]);

  return (
    <PermissionGate
      allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="w-full">
        {sortedAppointments.length === 0 ? (
          <div className="flex items-center justify-center text-body-4 text-text-primary">
            No appointments found
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="w-full rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer"
              >
                <AppointmentCardContent appointment={appointment} />
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
};

export default AppointmentHistoryList;
