import React, { useEffect, useMemo, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';

type ChangeRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

const ChangeRoom = ({ showModal, setShowModal, activeAppointment }: ChangeRoomProps) => {
  const rooms = useRoomsForPrimaryOrg();
  const roomOptions = useMemo(
    () => rooms.map((room) => ({ label: room.name, value: room.id })),
    [rooms]
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(activeAppointment.room?.id || '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRoomId(activeAppointment.room?.id || '');
    setErrorMessage(null);
  }, [activeAppointment, showModal]);

  const handleCancel = () => {
    setShowModal(false);
    setSelectedRoomId(activeAppointment.room?.id || '');
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!activeAppointment?.id || saving) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      const currentRoomId = activeAppointment.room?.id || '';
      if (currentRoomId === selectedRoomId) {
        setShowModal(false);
        return;
      }
      const nextRoom = rooms.find((room) => room.id === selectedRoomId);
      await updateAppointment({
        ...activeAppointment,
        room: nextRoom ? { id: nextRoom.id, name: nextRoom.name } : undefined,
      });
      setShowModal(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to update room. Please try again.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex flex-col gap-4 w-full">
        <ModalHeader title="Assign room" onClose={handleCancel} />
        <div className={`${saving ? 'pointer-events-none opacity-60' : ''}`}>
          <LabelDropdown
            placeholder="Select room"
            options={roomOptions}
            defaultOption={selectedRoomId}
            searchable={false}
            onSelect={(option) => setSelectedRoomId(option.value)}
          />
        </div>
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
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
            text={saving ? 'Saving...' : 'Update'}
            onClick={handleSave}
            isDisabled={saving}
            className="w-auto min-w-[120px]"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default ChangeRoom;
