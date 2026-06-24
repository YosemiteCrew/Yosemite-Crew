import React, { useRef, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { useNotify } from '@/app/hooks/useNotify';

type StatusOption<S extends string> = { value: S; label: string };

const resolveSelectedStatus = <S extends string>(
  currentStatus: S,
  preferredStatus: S | null,
  canTransition: (from: S, to: S) => boolean,
  statusOptions: StatusOption<S>[]
): S =>
  preferredStatus &&
  canTransition(currentStatus, preferredStatus) &&
  statusOptions.some((option) => option.value === preferredStatus)
    ? preferredStatus
    : currentStatus;

const buildSelectionKey = <S extends string>(
  showModal: boolean,
  currentStatus: S,
  preferredStatus: S | null,
  statusOptions: StatusOption<S>[]
) =>
  [
    showModal ? 'open' : 'closed',
    currentStatus,
    preferredStatus ?? '',
    statusOptions.map((option) => option.value).join('|'),
  ].join('::');

type ChangeStatusModalProps<S extends string> = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  currentStatus: S;
  defaultStatus: S;
  preferredStatus?: S | null;
  statusOptions: StatusOption<S>[];
  placeholder: string;
  canTransition: (from: S, to: S) => boolean;
  getInvalidMessage: (from: S, to: S) => string;
  validateBeforeSave?: (newStatus: S) => string | null;
  renderExtraContent?: (args: { selectedStatus: S; saving: boolean }) => React.ReactNode;
  onSave: (newStatus: S) => Promise<void>;
};

const ChangeStatusModal = <S extends string>({
  showModal,
  setShowModal,
  currentStatus,
  defaultStatus,
  preferredStatus = null,
  statusOptions,
  placeholder,
  canTransition,
  getInvalidMessage,
  validateBeforeSave,
  renderExtraContent,
  onSave,
}: ChangeStatusModalProps<S>) => {
  const { notify } = useNotify();
  const preferredSelection = resolveSelectedStatus(
    currentStatus,
    preferredStatus,
    canTransition,
    statusOptions
  );
  const [selectedStatus, setSelectedStatus] = useState<S>(preferredSelection);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previousSelectionKeyRef = useRef<string | null>(null);
  const selectionKey = buildSelectionKey(showModal, currentStatus, preferredStatus, statusOptions);

  if (previousSelectionKeyRef.current !== selectionKey) {
    previousSelectionKeyRef.current = selectionKey;
    const nextSelection = resolveSelectedStatus(
      currentStatus,
      preferredStatus,
      canTransition,
      statusOptions
    );
    if (selectedStatus !== nextSelection) {
      setSelectedStatus(nextSelection);
    }
    if (!showModal && errorMessage !== null) {
      setErrorMessage(null);
    }
  }

  const handleCancel = () => {
    setShowModal(false);
    setSelectedStatus(currentStatus);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      if (currentStatus === selectedStatus) {
        setShowModal(false);
        return;
      }
      if (!canTransition(currentStatus, selectedStatus)) {
        notify('warning', {
          title: 'Status update blocked',
          text: getInvalidMessage(currentStatus, selectedStatus),
        });
        return;
      }
      const validationMessage = validateBeforeSave?.(selectedStatus) ?? null;
      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }
      await onSave(selectedStatus);
      setShowModal(false);
    } catch (error) {
      console.log(error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to update status. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex flex-col gap-4 w-full">
        <ModalHeader title="Change status" onClose={handleCancel} />
        <div className="flex flex-col gap-2">
          <div className={saving ? 'pointer-events-none opacity-60' : ''}>
            <LabelDropdown
              placeholder={placeholder}
              options={statusOptions}
              defaultOption={selectedStatus ?? defaultStatus}
              searchable={false}
              onSelect={(option) => setSelectedStatus(option.value as S)}
            />
          </div>
          {renderExtraContent ? renderExtraContent({ selectedStatus, saving }) : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>
        <div className="flex items-center justify-center gap-2 w-full pb-3 flex-wrap">
          <Secondary
            href="#"
            text="Cancel"
            onClick={handleCancel}
            isDisabled={saving}
            className="w-auto min-w-30"
          />
          <Primary
            href="#"
            text={saving ? 'Saving...' : 'Update'}
            onClick={handleSave}
            isDisabled={saving}
            className="w-auto min-w-30"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default ChangeStatusModal;
