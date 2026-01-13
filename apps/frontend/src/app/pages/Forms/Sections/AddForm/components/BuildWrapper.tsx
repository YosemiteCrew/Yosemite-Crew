import { FormField } from "@/app/types/forms";
import { MdDeleteForever } from "react-icons/md";
import { IoMdArrowUp, IoMdArrowDown } from "react-icons/io";
import { MdDragIndicator } from "react-icons/md";

const BuilderWrapper: React.FC<{
  field: FormField;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: React.ReactNode;
}> = ({ field, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, children }) => {
  const title = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  return (
    <div className="border border-grey-light rounded-2xl px-3 py-3 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MdDragIndicator size={20} color="#999999" className="cursor-grab" />
          <div className="font-grotesk text-black-text text-[18px] font-medium">
            {title}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={`${!canMoveUp ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"} rounded p-1`}
              title="Move up"
            >
              <IoMdArrowUp size={20} color="#302f2e" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={`${!canMoveDown ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"} rounded p-1`}
              title="Move down"
            >
              <IoMdArrowDown size={20} color="#302f2e" />
            </button>
          )}
          <button onClick={onDelete} className="hover:bg-red-50 rounded p-1">
            <MdDeleteForever size={20} color="#EA3729" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default BuilderWrapper;
