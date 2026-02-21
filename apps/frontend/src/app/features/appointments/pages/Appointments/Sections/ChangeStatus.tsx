import React, { useEffect, useState } from "react";
import { Primary, Secondary } from "@/app/ui/primitives/Buttons";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import { Appointment } from "@yosemite-crew/types";
import { updateAppointment } from "@/app/features/appointments/services/appointmentService";
import LabelDropdown from "@/app/ui/inputs/Dropdown/LabelDropdown";
import {
  AppointmentStatus,
  AppointmentStatusOptions,
} from "@/app/features/appointments/types/appointments";

type ChangeStatusProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

const ChangeStatus = ({
  showModal,
  setShowModal,
  activeAppointment,
}: ChangeStatusProps) => {
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus>(
    (activeAppointment.status as AppointmentStatus) ?? "REQUESTED",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedStatus(
      (activeAppointment.status as AppointmentStatus) ?? "REQUESTED",
    );
  }, [activeAppointment]);

  const handleCancel = () => {
    setShowModal(false);
    setSelectedStatus(
      (activeAppointment.status as AppointmentStatus) ?? "REQUESTED",
    );
  };

  const handleSave = async () => {
    if (!activeAppointment?.id || saving) return;
    try {
      setSaving(true);
      await updateAppointment({
        ...activeAppointment,
        status: selectedStatus,
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenterModal
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={handleCancel}
    >
      <div className="flex flex-col gap-4 w-full">
        <ModalHeader title="Change status" onClose={handleCancel} />
        <div className="flex flex-col gap-2">
          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
            <LabelDropdown
              placeholder="Appointment status"
              options={AppointmentStatusOptions.filter(
                (option) => option.value !== "NO_PAYMENT",
              )}
              defaultOption={selectedStatus}
              searchable={false}
              onSelect={(option) =>
                setSelectedStatus(option.value as AppointmentStatus)
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 w-full">
          <Secondary
            href="#"
            text="Cancel"
            onClick={handleCancel}
            isDisabled={saving}
            className="w-full!"
          />
          <Primary
            href="#"
            text={saving ? "Saving..." : "Update"}
            onClick={handleSave}
            isDisabled={saving}
            classname="w-full!"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default ChangeStatus;
