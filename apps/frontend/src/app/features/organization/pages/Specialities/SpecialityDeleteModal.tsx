import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';

type SpecialityDeleteModalProps = {
  specialityName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const SpecialityDeleteModal = ({
  specialityName,
  deleting,
  onCancel,
  onConfirm,
}: SpecialityDeleteModalProps) => (
  <CenterModal showModal setShowModal={onCancel}>
    <ModalHeader title="Delete speciality" onClose={onCancel} />
    <p className="text-body-4 text-text-primary">
      Are you sure you want to delete <strong>{specialityName}</strong>? This will remove the
      speciality and is only possible if it has no services, packages, or historical usage. This
      action cannot be undone.
    </p>
    <div className="grid grid-cols-2 gap-3">
      <Secondary href="#" text="Cancel" onClick={onCancel} />
      <Delete
        href="#"
        text={deleting ? 'Deleting...' : 'Delete'}
        onClick={() => {
          if (deleting) return;
          onConfirm();
        }}
      />
    </div>
  </CenterModal>
);

export default SpecialityDeleteModal;
