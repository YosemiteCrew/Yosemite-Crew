import { FormField } from "@/app/types/forms";
import { MdDeleteForever } from "react-icons/md";

const BuilderWrapper: React.FC<{
  field: FormField;
  onDelete: () => void;
  children: React.ReactNode;
}> = ({ field, onDelete, children }) => {
  const title = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  return (
    <div className="border border-grey-light rounded-2xl px-3 py-3 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="font-grotesk text-black-text text-[18px] font-medium">
          {title}
        </div>
        <button onClick={onDelete}>
          <MdDeleteForever size={20} color="#EA3729" />
        </button>
      </div>
      {children}
    </div>
  );
};

export default BuilderWrapper;
