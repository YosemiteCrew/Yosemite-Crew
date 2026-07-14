import React from 'react';
import { RiEdit2Line } from 'react-icons/ri';
import { MdDeleteForever } from 'react-icons/md';
import { FiCheck, FiX } from 'react-icons/fi';

type SpecialityNameEditorProps = {
  editingName: boolean;
  nameInputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  nameValue: string;
  nameError: string;
  specialityName: string;
  totalCount: number;
  onToggleOpen: () => void;
  onNameChange: (value: string) => void;
  onNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSaveName: (e: React.MouseEvent) => void;
  onCancelName: (e: React.MouseEvent) => void;
  onEditClick: (e: React.MouseEvent) => void;
  onRequestDelete: (e: React.MouseEvent) => void;
};

const SpecialityNameEditor = ({
  editingName,
  nameInputId,
  inputRef,
  nameValue,
  nameError,
  specialityName,
  totalCount,
  onToggleOpen,
  onNameChange,
  onNameKeyDown,
  onSaveName,
  onCancelName,
  onEditClick,
  onRequestDelete,
}: SpecialityNameEditorProps) => {
  if (editingName) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label htmlFor={nameInputId} className="sr-only">
          Speciality name
        </label>
        <input
          ref={inputRef}
          id={nameInputId}
          type="text"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={onNameKeyDown}
          className="flex-1 min-w-0 text-heading-3 text-text-primary bg-transparent border-b-2 border-input-border-active focus-visible:outline-none px-1"
          aria-label="Edit speciality name"
          aria-invalid={Boolean(nameError)}
        />
        <button
          type="button"
          aria-label="Save name"
          onClick={onSaveName}
          className="flex items-center justify-center size-8 rounded-full bg-text-brand text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand shrink-0"
        >
          <FiCheck size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Cancel rename"
          onClick={onCancelName}
          className="flex items-center justify-center size-8 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors shrink-0"
        >
          <FiX size={14} color="var(--color-danger-600)" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${specialityName}`}
          onClick={onRequestDelete}
          className="flex items-center justify-center size-8 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors shrink-0"
        >
          <MdDeleteForever size={16} color="var(--color-danger-600)" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="text-heading-3 text-text-primary text-left truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
        onClick={onToggleOpen}
      >
        <span className="truncate">{specialityName}</span>{' '}
        <span className="text-text-secondary font-normal whitespace-nowrap">({totalCount})</span>
      </button>
      <button
        type="button"
        aria-label={`Rename ${specialityName}`}
        onClick={onEditClick}
        className="flex items-center justify-center size-9 rounded-full border border-transparent hover:border-card-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors shrink-0"
      >
        <RiEdit2Line size={18} color="var(--color-neutral-700)" aria-hidden="true" />
      </button>
    </>
  );
};

export default SpecialityNameEditor;
