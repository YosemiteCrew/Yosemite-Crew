import React, { useEffect, useState } from "react";
import { Primary, Secondary } from "@/app/ui/primitives/Buttons";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import { Appointment } from "@yosemite-crew/types";
import {
  acceptAppointment,
  cancelAppointment,
  checkInAppointment,
} from "@/app/features/appointments/services/appointmentService";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setErrorMessage(null);
  };

  const getUnsupportedTransitionMessage = (
    from: AppointmentStatus,
    to: AppointmentStatus,
  ) =>
    `Status change ${from} -> ${to} is not supported by current backend endpoints.`;

  const handleSave = async () => {
    if (!activeAppointment?.id || saving) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      const currentStatus =
        (activeAppointment.status as AppointmentStatus) ?? "REQUESTED";

      if (currentStatus === selectedStatus) {
        setShowModal(false);
        return;
      }

      if (selectedStatus === "CANCELLED") {
        await cancelAppointment(activeAppointment);
      } else if (
        selectedStatus === "UPCOMING" &&
        (currentStatus === "REQUESTED" || currentStatus === "NO_PAYMENT")
      ) {
        await acceptAppointment(activeAppointment);
      } else if (
        selectedStatus === "CHECKED_IN" &&
        currentStatus === "UPCOMING"
      ) {
        await checkInAppointment(activeAppointment);
      } else {
        setErrorMessage(
          getUnsupportedTransitionMessage(currentStatus, selectedStatus),
        );
        return;
      }
      setShowModal(false);
    } catch (error) {
      console.log(error);
      setErrorMessage("Unable to update status. Please try again.");
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
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-2 w-full pb-3 flex-wrap">
          <Secondary
            href="#"
            text="Cancel"
            onClick={handleCancel}
            isDisabled={saving}
            className="w-auto min-w-[120px]"
          />
          <Primary
            href="#"
            text={saving ? "Saving..." : "Update"}
            onClick={handleSave}
            isDisabled={saving}
            classname="w-auto min-w-[120px]"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default ChangeStatus;
