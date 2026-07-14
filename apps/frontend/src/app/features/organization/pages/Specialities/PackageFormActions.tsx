import { FiCheck } from 'react-icons/fi';
import { MdDeleteForever } from 'react-icons/md';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';

type PackageFormActionsProps = {
  isEditing: boolean;
  onCancel: () => void;
  onDeleteClick: () => void;
  onSave: () => void;
};

const PackageFormActions = ({
  isEditing,
  onCancel,
  onDeleteClick,
  onSave,
}: PackageFormActionsProps) => (
  <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
    {isEditing ? (
      <Secondary
        href="#"
        danger
        text="Delete Package"
        icon={<MdDeleteForever size={16} />}
        onClick={onDeleteClick}
      />
    ) : (
      <div />
    )}
    <div className="flex gap-3">
      <Secondary href="#" text="Cancel" onClick={onCancel} />
      <Primary
        href="#"
        text="Save Package"
        icon={<FiCheck size={16} />}
        onClick={() => {
          Promise.resolve(onSave()).catch(() => undefined);
        }}
      />
    </div>
  </div>
);

export default PackageFormActions;
