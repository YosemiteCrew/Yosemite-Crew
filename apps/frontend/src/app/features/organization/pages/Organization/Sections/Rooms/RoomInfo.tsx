import type React from 'react';
import type { OrganisationRoom } from '@yosemite-crew/types';
import RoomInfoContent from './RoomInfoContent';
import { useRoomInfoController } from './useRoomInfoController';
export type { ManagedRoom, RoomUnitDetails } from './RoomInfo.types';

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
  canEditRoom: boolean;
};

const RoomInfo = ({ showModal, setShowModal, activeRoom, canEditRoom }: RoomInfoProps) => {
  const roomInfo = useRoomInfoController({ showModal, setShowModal, activeRoom });

  return (
    <RoomInfoContent
      activeRoom={activeRoom}
      availabilityLabels={roomInfo.availabilityLabels}
      permissions={{ canEditRoom }}
      customEquipmentName={roomInfo.customEquipmentName}
      equipmentLabel={roomInfo.equipmentLabel}
      formData={roomInfo.formData}
      state={{
        isDirty: roomInfo.isDirty,
        saving: roomInfo.saving,
        supportsUnits: roomInfo.supportsUnits,
      }}
      mode={roomInfo.mode}
      openSections={roomInfo.openSections}
      roomTypeLabel={roomInfo.roomTypeLabel}
      setMode={roomInfo.setMode}
      setShowDeleteModal={roomInfo.setShowDeleteModal}
      setShowDiscardConfirm={roomInfo.setShowDiscardConfirm}
      setShowModal={setShowModal}
      visibility={{
        showDeleteModal: roomInfo.showDeleteModal,
        showDiscardConfirm: roomInfo.showDiscardConfirm,
        showModal,
      }}
      specialityLabel={roomInfo.specialityLabel}
      staffLabel={roomInfo.staffLabel}
      totalUnits={roomInfo.totalUnits}
      options={roomInfo.options}
      onAddCustomEquipment={roomInfo.addCustomEquipment}
      onAddUnit={roomInfo.addUnitDraft}
      onAvailabilityToggle={(checked) => {
        Promise.resolve(roomInfo.handleAvailabilityToggle(checked)).catch(() => undefined);
      }}
      onCloseDrawer={roomInfo.closeDrawer}
      onCustomEquipmentNameChange={roomInfo.setCustomEquipmentName}
      onDelete={() => {
        Promise.resolve(roomInfo.handleDelete()).catch(() => undefined);
      }}
      onDiscardChanges={roomInfo.discardChanges}
      onFormChange={roomInfo.updateFormData}
      onRoomTypeChange={roomInfo.handleRoomTypeChange}
      onSave={() => {
        Promise.resolve(roomInfo.handleUpdate()).catch(() => undefined);
      }}
      onToggleSection={roomInfo.toggleSection}
      onUpdateAvailability={roomInfo.updateAvailability}
      onUpdateUnit={roomInfo.updateUnit}
    />
  );
};

export default RoomInfo;
