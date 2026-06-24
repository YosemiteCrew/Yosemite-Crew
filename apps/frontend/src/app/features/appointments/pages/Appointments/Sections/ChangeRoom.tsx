import React, { useMemo, useState, useRef } from 'react';
import { Appointment } from '@yosemite-crew/types';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import {
  assignEncounterUnit,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

type ChangeRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

const getFirstUnitIdForRoom = (
  roomId: string,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) =>
  (roomUnitIdsByRoomId[roomId] ?? [])
    .map((unitId) => roomUnitsById[unitId])
    .find((unit) => unit?.isActive !== false)?.id;

const ChangeRoom = ({ showModal, setShowModal, activeAppointment }: ChangeRoomProps) => {
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((state) => state.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((state) => state.roomUnitIdsByRoomId);
  const initEncounter = useAppointmentWorkspaceStore((state) => state.initEncounter);
  const setRoomUnit = useAppointmentWorkspaceStore((state) => state.setRoomUnit);
  const encounter = useAppointmentWorkspaceStore((state) =>
    activeAppointment.id ? state.encountersById[activeAppointment.id] : undefined
  );
  const isInpatient = activeAppointment.appointmentKind === 'INPATIENT';
  const roomOptions = useMemo(
    () => rooms.map((room) => ({ label: room.name, value: room.id })),
    [rooms]
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(activeAppointment.room?.id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    encounter?.unitId ||
      getFirstUnitIdForRoom(activeAppointment.room?.id || '', roomUnitsById, roomUnitIdsByRoomId) ||
      ''
  );
  const selectedRoomUnits = useMemo(
    () =>
      (roomUnitIdsByRoomId[selectedRoomId] ?? []).flatMap((unitId) => {
        const unit = roomUnitsById[unitId];
        return unit && unit.isActive !== false ? [unit] : [];
      }),
    [roomUnitIdsByRoomId, roomUnitsById, selectedRoomId]
  );
  const unitOptions = useMemo(
    () =>
      selectedRoomUnits.map((unit) => ({
        label: unit.displayName || unit.code,
        value: unit.id,
      })),
    [selectedRoomUnits]
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const prevResetKeyRef = useRef({ appointment: activeAppointment, showModal });
  const resetKey = { appointment: activeAppointment, showModal };
  if (
    prevResetKeyRef.current.appointment !== activeAppointment ||
    prevResetKeyRef.current.showModal !== showModal
  ) {
    prevResetKeyRef.current = resetKey;
    const newRoomId = activeAppointment.room?.id || '';
    if (selectedRoomId !== newRoomId) setSelectedRoomId(newRoomId);
    const newUnitId =
      encounter?.unitId ||
      getFirstUnitIdForRoom(newRoomId, roomUnitsById, roomUnitIdsByRoomId) ||
      '';
    if (selectedUnitId !== newUnitId) setSelectedUnitId(newUnitId);
    if (errorMessage !== null) setErrorMessage(null);
  }

  const handleCancel = () => {
    setShowModal(false);
    setSelectedRoomId(activeAppointment.room?.id || '');
    setSelectedUnitId(encounter?.unitId || '');
    setErrorMessage(null);
  };

  const handleRoomSelect = (option: { value: string }) => {
    setSelectedRoomId(option.value);
    setSelectedUnitId(
      isInpatient
        ? getFirstUnitIdForRoom(option.value, roomUnitsById, roomUnitIdsByRoomId) || ''
        : ''
    );
  };

  const handleSave = async () => {
    if (!activeAppointment?.id || saving) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      const currentRoomId = activeAppointment.room?.id || '';
      if (
        currentRoomId === selectedRoomId &&
        (!isInpatient || encounter?.unitId === selectedUnitId)
      ) {
        setShowModal(false);
        return;
      }
      const nextRoom = rooms.find((room) => room.id === selectedRoomId);
      await updateAppointment({
        ...activeAppointment,
        room: nextRoom ? { id: nextRoom.id, name: nextRoom.name } : undefined,
      });
      if (isInpatient) {
        initEncounter(activeAppointment.id, 'INPATIENT', {
          leadId: activeAppointment.lead?.id,
          leadName: activeAppointment.lead?.name,
        });
        setRoomUnit(activeAppointment.id, selectedRoomId || undefined, selectedUnitId || undefined);
        if (activeAppointment.encounterId && selectedUnitId) {
          await assignEncounterUnit({
            encounterId: activeAppointment.encounterId,
            unitId: selectedUnitId,
            reason: 'Appointment room assignment',
          });
        }
      }
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
            onSelect={handleRoomSelect}
          />
        </div>
        {isInpatient ? (
          <div className={`${saving ? 'pointer-events-none opacity-60' : ''}`}>
            <LabelDropdown
              placeholder="Select unit"
              options={unitOptions}
              defaultOption={selectedUnitId}
              searchable={false}
              onSelect={(option) => setSelectedUnitId(option.value)}
            />
          </div>
        ) : null}
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
