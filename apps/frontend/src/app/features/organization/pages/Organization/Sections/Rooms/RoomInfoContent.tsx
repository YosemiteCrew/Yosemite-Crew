import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import Close from '@/app/ui/primitives/Icons/Close';
import { FiCheck, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { OrganisationRoom } from '@yosemite-crew/types';
import type { ManagedRoom, RoomUnitDetails } from './RoomInfo.types';
import RoomInfoSections, { OpenSections } from './RoomInfoSections';

type SelectOption = { label: string; value: string };
type Mode = 'view' | 'edit';

const IconCircleButton = ({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex size-8 items-center justify-center rounded-full border ${
      danger
        ? 'border-text-error bg-white text-text-error'
        : 'border-text-primary bg-text-primary text-white'
    }`}
  >
    {children}
  </button>
);

type RoomInfoContentProps = {
  activeRoom: OrganisationRoom;
  availabilityLabels: {
    days: string;
    species: string;
    time: string;
  };
  permissions: {
    canEditRoom: boolean;
  };
  customEquipmentName: string;
  equipmentLabel: string;
  formData: ManagedRoom;
  state: {
    isDirty: boolean;
    saving: boolean;
    supportsUnits: boolean;
  };
  mode: Mode;
  openSections: OpenSections;
  roomTypeLabel: string;
  setMode: Dispatch<SetStateAction<Mode>>;
  setShowDeleteModal: Dispatch<SetStateAction<boolean>>;
  setShowDiscardConfirm: Dispatch<SetStateAction<boolean>>;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  visibility: {
    showDeleteModal: boolean;
    showDiscardConfirm: boolean;
    showModal: boolean;
  };
  specialityLabel: string;
  staffLabel: string;
  totalUnits: number;
  options: {
    equipment: string[];
    specialities: SelectOption[];
    team: SelectOption[];
  };
  onAddCustomEquipment: () => void;
  onAddUnit: () => void;
  onAvailabilityToggle: (checked: boolean) => void;
  onCloseDrawer: () => void;
  onCustomEquipmentNameChange: (value: string) => void;
  onDelete: () => void;
  onDiscardChanges: () => void;
  onFormChange: (patch: Partial<ManagedRoom>) => void;
  onRoomTypeChange: (type: OrganisationRoom['type']) => void;
  onSave: () => void;
  onToggleSection: (section: keyof OpenSections) => void;
  onUpdateAvailability: (patch: Partial<NonNullable<ManagedRoom['availability']>>) => void;
  onUpdateUnit: (id: string, patch: Partial<RoomUnitDetails>) => void;
};

const RoomInfoContent = ({
  activeRoom,
  availabilityLabels,
  permissions,
  customEquipmentName,
  equipmentLabel,
  formData,
  state,
  mode,
  openSections,
  roomTypeLabel,
  setMode,
  setShowDeleteModal,
  setShowDiscardConfirm,
  setShowModal,
  visibility,
  specialityLabel,
  staffLabel,
  totalUnits,
  options,
  onAddCustomEquipment,
  onAddUnit,
  onAvailabilityToggle,
  onCloseDrawer,
  onCustomEquipmentNameChange,
  onDelete,
  onDiscardChanges,
  onFormChange,
  onRoomTypeChange,
  onSave,
  onToggleSection,
  onUpdateAvailability,
  onUpdateUnit,
}: RoomInfoContentProps) => (
  <>
    <Modal
      showModal={visibility.showModal}
      setShowModal={setShowModal}
      canClose={() => {
        if (mode === 'edit' && state.isDirty) {
          setShowDiscardConfirm(true);
          return false;
        }
        return true;
      }}
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-center justify-between border-b border-card-border pb-4">
          <h2 className="text-body-1 text-text-primary">
            {mode === 'edit' ? 'Edit room' : formData.name}
          </h2>
          <div className="flex items-center gap-3">
            {permissions.canEditRoom && mode === 'view' && (
              <IconCircleButton label="Edit room" onClick={() => setMode('edit')}>
                <FiEdit2 size={15} aria-hidden="true" />
              </IconCircleButton>
            )}
            {permissions.canEditRoom && (
              <IconCircleButton label="Delete room" onClick={() => setShowDeleteModal(true)} danger>
                <FiTrash2 size={15} aria-hidden="true" />
              </IconCircleButton>
            )}
            <Close onClick={onCloseDrawer} />
          </div>
        </div>

        <RoomInfoSections
          canEditRoom={permissions.canEditRoom}
          customEquipmentName={customEquipmentName}
          equipmentLabel={equipmentLabel}
          formData={formData}
          mode={mode}
          openSections={openSections}
          roomTypeLabel={roomTypeLabel}
          specialityLabel={specialityLabel}
          staffLabel={staffLabel}
          supportsUnits={state.supportsUnits}
          totalUnits={totalUnits}
          availabilityLabels={availabilityLabels}
          options={options}
          onAddCustomEquipment={onAddCustomEquipment}
          onAddUnit={onAddUnit}
          onAvailabilityToggle={onAvailabilityToggle}
          onCustomEquipmentNameChange={onCustomEquipmentNameChange}
          onFormChange={onFormChange}
          onRoomTypeChange={onRoomTypeChange}
          onToggleSection={onToggleSection}
          onUpdateAvailability={onUpdateAvailability}
          onUpdateUnit={onUpdateUnit}
        />

        {mode === 'edit' && (
          <div className="flex justify-between gap-3 border-t border-card-border pt-4">
            <Secondary href="#" text="Discard" onClick={onDiscardChanges} />
            <Primary
              href="#"
              text={state.saving ? 'Saving...' : 'Save'}
              onClick={onSave}
              icon={<FiCheck size={16} aria-hidden="true" />}
            />
          </div>
        )}
      </div>
    </Modal>

    <CenterModal showModal={visibility.showDiscardConfirm} setShowModal={setShowDiscardConfirm}>
      <ModalHeader title="Discard changes?" onClose={() => setShowDiscardConfirm(false)} />
      <p className="text-body-4 text-text-primary">
        You have unsaved room changes. Are you sure you want to discard them?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Secondary href="#" text="Keep editing" onClick={() => setShowDiscardConfirm(false)} />
        <Primary href="#" text="Discard" onClick={onDiscardChanges} />
      </div>
    </CenterModal>

    <CenterModal showModal={visibility.showDeleteModal} setShowModal={setShowDeleteModal}>
      <ModalHeader title="Delete room?" onClose={() => setShowDeleteModal(false)} />
      <p className="text-body-4 text-text-primary">
        Are you sure you want to delete <strong>{activeRoom.name}</strong>? This action cannot be
        undone.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Secondary href="#" text="Cancel" onClick={() => setShowDeleteModal(false)} />
        <Delete href="#" text="Delete" onClick={onDelete} />
      </div>
    </CenterModal>
  </>
);

export default RoomInfoContent;
