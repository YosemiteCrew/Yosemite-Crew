import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';

type PackageDeleteModalProps = {
  packageName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const PackageDeleteModal = ({ packageName, onCancel, onConfirm }: PackageDeleteModalProps) => (
  <CenterModal showModal setShowModal={onCancel}>
    <ModalHeader title="Delete package" onClose={onCancel} />
    <p className="text-body-4 text-text-primary">
      Are you sure you want to delete <strong>{packageName}</strong>? This permanently removes the
      package and cannot be undone. If it is used elsewhere or has historical usage, consider
      archiving instead.
    </p>
    <div className="grid grid-cols-2 gap-3">
      <Secondary href="#" text="Cancel" onClick={onCancel} />
      <Delete href="#" text="Delete" onClick={onConfirm} />
    </div>
  </CenterModal>
);

export default PackageDeleteModal;
