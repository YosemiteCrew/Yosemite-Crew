import React, { useMemo } from "react";
import Image from "next/image";
import { PermissionGate } from "@/app/components/PermissionGate";
import Fallback from "@/app/components/Fallback";
import { PERMISSIONS } from "@/app/utils/permissions";
import { useAppointmentsForCompanionInPrimaryOrg } from "@/app/hooks/useAppointments";
import { getSafeImageUrl, ImageType } from "@/app/utils/urls";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";
import { getStatusStyle } from "@/app/components/DataTable/Appointments";
import { toTitle } from "@/app/utils/validators";
import AppointmentDetailField from "./AppointmentDetailField";

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
                <div className="flex gap-2 items-center">
                  <Image
                    alt={""}
                    src={getSafeImageUrl(
                      "",
                      appointment.companion.species as ImageType,
                    )}
                    height={40}
                    width={40}
                    style={{ borderRadius: "50%" }}
                    className="h-10 w-10 rounded-full"
                  />
                  <div className="flex flex-col gap-0">
                    <div className="text-body-3-emphasis text-text-primary">
                      {appointment.companion?.name}
                    </div>
                    <div className="text-caption-1 text-text-primary">
                      {appointment.companion?.parent?.name}
                    </div>
                  </div>
                </div>
                <AppointmentDetailField
                  label="Breed / Species"
                  value={`${appointment.companion?.breed || "-"} / ${appointment.companion?.species}`}
                />
                <AppointmentDetailField
                  label="Date / Time"
                  value={`${formatDateLabel(appointment.appointmentDate)} / ${formatTimeLabel(appointment.startTime)}`}
                />
                <AppointmentDetailField label="Reason" value={appointment.concern} />
                <AppointmentDetailField label="Service" value={appointment.appointmentType?.name} />
                <AppointmentDetailField label="Room" value={appointment.room?.name} />
                <AppointmentDetailField label="Lead" value={appointment.lead?.name} />
                <AppointmentDetailField
                  label="Staff"
                  value={appointment.supportStaff?.map((sup) => sup.name).join(", ")}
                />
                <div
                  style={getStatusStyle(appointment.status)}
                  className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
                >
                  {toTitle(appointment.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
};

export default AppointmentHistoryList;
