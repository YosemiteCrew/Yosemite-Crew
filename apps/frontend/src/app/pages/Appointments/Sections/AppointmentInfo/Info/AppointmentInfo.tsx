import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
import { useRoomsForPrimaryOrg } from "@/app/hooks/useRooms";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { updateAppointment } from "@/app/services/appointmentService";
import { Appointment } from "@yosemite-crew/types";
import React, { useMemo } from "react";

const getAppointmentFields = ({
  RoomOptions,
}: {
  RoomOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Reason", key: "concern", type: "text", required: true },
    {
      label: "Room",
      key: "room",
      type: "dropdown",
      options: RoomOptions,
      required: true,
    },
    {
      label: "Service",
      key: "service",
      type: "text",
      editable: false,
    },
    {
      label: "Date",
      key: "date",
      type: "date",
      editable: false,
    },
    {
      label: "Time",
      key: "time",
      type: "date",
      editable: false,
    },
    {
      label: "Status",
      key: "status",
      type: "text",
      editable: false,
    },
  ] satisfies FieldConfig[];

const getStaffFields = ({
  TeamOptions,
}: {
  TeamOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Lead", key: "lead", type: "text", editable: false },
    {
      label: "Staff",
      key: "staff",
      type: "multi",
      options: TeamOptions,
      required: true,
    },
  ] satisfies FieldConfig[];

type AppointmentInfoProps = {
  activeAppointment: Appointment;
};

const AppointmentInfo = ({ activeAppointment }: AppointmentInfoProps) => {
  const rooms = useRoomsForPrimaryOrg();
  const teams = useTeamForPrimaryOrg();

  const RoomOptions = useMemo(
    () =>
      rooms?.map((room) => ({
        label: room.name,
        value: room.id,
      })),
    [rooms]
  );

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team._id,
        value: team._id,
      })),
    [teams]
  );

  const staffFields = useMemo(
    () => getStaffFields({ TeamOptions }),
    [TeamOptions]
  );

  const appointmentFields = useMemo(
    () => getAppointmentFields({ RoomOptions }),
    [RoomOptions]
  );

  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? "",
      room: activeAppointment.room?.name ?? "",
      service: activeAppointment.appointmentType?.name ?? "",
      date: activeAppointment.appointmentDate ?? "",
      time: activeAppointment.startTime ?? "",
      status: activeAppointment.status ?? "",
    }),
    [activeAppointment]
  );

  const StaffInfoData = useMemo(
    () => ({
      lead: activeAppointment.lead?.name ?? "",
      staff: activeAppointment.supportStaff?.map((s) => s.name) ?? "",
    }),
    [activeAppointment]
  );

  const handleAppointmentUpdate = async (values: any) => {
    try {
      const formData: Appointment = {
        ...activeAppointment,
        concern: values.concern,
      };
      await updateAppointment(formData);
    } catch (error) {
      console.log(error);
    }
  };

  const handleStaffUpdate = async (values: any) => {
    try {
      const formData: Appointment = {
        ...activeAppointment,
      };
      await updateAppointment(formData);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        key={"Appointments-key"}
        title={"Appointments details"}
        fields={appointmentFields}
        data={AppointmentInfoData}
        defaultOpen={true}
        onSave={handleAppointmentUpdate}
      />
      <EditableAccordion
        key={"staff-key"}
        title={"Staff details"}
        fields={staffFields}
        data={StaffInfoData}
        defaultOpen={true}
        onSave={handleStaffUpdate}
      />
    </div>
  );
};

export default AppointmentInfo;
