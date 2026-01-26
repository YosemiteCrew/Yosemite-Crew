import React from "react";
import { FormField } from "@/app/types/forms";
import { MdDeleteForever, MdDragIndicator } from "react-icons/md";
import { IoMdArrowUp, IoMdArrowDown } from "react-icons/io";

const BuilderWrapper: React.FC<{
  field: FormField;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  children: React.ReactNode;
}> = ({
  field,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  children,
}) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const dragPreviewRef = React.useRef<HTMLDivElement | null>(null);
  const title = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  const cleanupDragPreview = () => {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onDragStart) return;
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const clone = wrapperRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${rect.width}px`;
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.borderRadius = "16px";
      clone.style.overflow = "hidden";
      clone.style.background = "#fff";
      clone.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08)";
      document.body.appendChild(clone);
      dragPreviewRef.current = clone;
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(
        clone,
        Math.max(0, Math.min(rect.width, offsetX)),
        Math.max(0, Math.min(rect.height, offsetY))
      );
    }
    onDragStart(e);
  };

  const handleDragEndInternal = (e: React.DragEvent<HTMLDivElement>) => {
    cleanupDragPreview();
    onDragEnd?.(e);
  };

  return (
    <div
      ref={wrapperRef}
      className={`border border-grey-light rounded-2xl px-3 py-3 flex flex-col gap-3 bg-white ${
        isDragging ? "rounded-2xl" : ""
      }`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={handleDragEndInternal}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MdDragIndicator
            size={20}
            color="#999999"
            className={`cursor-grab ${draggable ? "opacity-100" : "opacity-50"}`}
            data-drag-handle
          />
          <div className="font-grotesk text-black-text text-[18px] font-medium">
            {title}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={`${canMoveUp ? "cursor-pointer hover:bg-gray-100" : "opacity-30 cursor-not-allowed"} rounded p-1`}
              title="Move up"
            >
              <IoMdArrowUp size={20} color="#302f2e" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={`${canMoveDown ? "cursor-pointer hover:bg-gray-100" : "opacity-30 cursor-not-allowed"} rounded p-1`}
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
