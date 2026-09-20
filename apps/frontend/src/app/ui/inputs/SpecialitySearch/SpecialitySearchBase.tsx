import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { specialties as SPECIALITIES } from '@/app/lib/specialities';
import { useOrgStore } from '@/app/stores/orgStore';
import { useListboxKeyboardNav } from '@/app/ui/inputs/Dropdown/useDropdownKeyboardNav';

import './SpecialitySearch.css';

const DEFAULT_CURRENT_SPECIALITIES: never[] = [];

/** One row of the results listbox: a matching speciality, or the single "add new" row shown when nothing matches. */
type SpecialityOption =
  { id: string; kind: 'speciality'; name: string } | { id: 'add'; kind: 'add' };

type SpecialitySearchBaseProps<T extends { name: string }> = {
  organisationId?: string | null;
  specialities: T[];
  setSpecialities: React.Dispatch<React.SetStateAction<T[]>>;
  multiple?: boolean;
  currentSpecialities?: T[];
};

const SpecialitySearchBase = <T extends { name: string }>({
  organisationId,
  specialities,
  setSpecialities,
  multiple = true,
  currentSpecialities = DEFAULT_CURRENT_SPECIALITIES,
}: SpecialitySearchBaseProps<T>) => {
  const uid = useId();
  const inputId = `speciality-search-input-${uid}`;
  const listboxId = `speciality-search-listbox-${uid}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const currentNames = useMemo(
    () => new Set(currentSpecialities.map((s) => s.name.toLowerCase())),
    [currentSpecialities]
  );

  const selectedNames = useMemo(
    () => new Set(specialities.map((s) => s.name.toLowerCase())),
    [specialities]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPECIALITIES.filter((s: any) => {
      const name = s.name.toLowerCase();
      if (selectedNames.has(name)) return false;
      if (currentNames.has(name)) return false;
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, selectedNames, currentNames]);

  const listOptions: SpecialityOption[] = useMemo(
    () =>
      filtered.length > 0
        ? filtered.map((speciality: { name: string }, index: number) => ({
            id: String(index),
            kind: 'speciality' as const,
            name: speciality.name,
          }))
        : [{ id: 'add', kind: 'add' as const }],
    [filtered]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectSpeciality = (speciality: { name: string }) => {
    const resolvedOrgId = organisationId ?? primaryOrgId ?? '';
    if (!resolvedOrgId) return;
    const newItem = {
      name: speciality.name,
      organisationId: resolvedOrgId,
    } as unknown as T;
    setSpecialities((prev: T[]) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some((s) => s.name.toLowerCase() === speciality.name.toLowerCase());
      if (exists) return prev;
      return [...prev, newItem];
    });
    setQuery('');
    setOpen(false);
  };

  const handleAddSpeciality = () => {
    const name = query.trim();
    if (!name) return;
    const resolvedOrgId = organisationId ?? primaryOrgId ?? '';
    if (!resolvedOrgId) return;
    const newItem = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      organisationId: resolvedOrgId,
    } as unknown as T;
    setSpecialities((prev) => {
      if (!multiple) {
        return [newItem];
      }
      const exists = prev.some((s) => s.name.toLowerCase() === name.toLowerCase());
      if (exists) return prev;
      return [newItem, ...prev];
    });
    setQuery('');
    setOpen(false);
  };

  const selectOption = (option: SpecialityOption) => {
    if (option.kind === 'add') {
      handleAddSpeciality();
    } else {
      handleSelectSpeciality({ name: option.name });
    }
  };

  const { activeOptionId, handleKeyDown } = useListboxKeyboardNav({
    open,
    openDropdown: () => setOpen(true),
    closeDropdown: () => setOpen(false),
    options: listOptions,
    listboxId,
    selectionKey: undefined,
    getOptionValue: (option) => option.id,
    isOptionSelected: () => false,
    selectOption,
    spaceSkipsInput: true,
  });

  return (
    <div className="step-search" ref={wrapperRef}>
      <IoSearch size={15} className="step-search-icon" color="var(--color-text-tertiary)" />
      <input
        type="text"
        id={inputId}
        name={inputId}
        aria-label="Search or create specialty"
        placeholder="Search or create specialty"
        className="step-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
      />
      {open && (
        <div
          className="step-search-dropdown"
          id={listboxId}
          role="listbox"
          aria-label="Speciality results"
        >
          {listOptions.map((option) => {
            const optionId = `${listboxId}-option-${option.id}`;
            const isActive = activeOptionId === optionId;
            if (option.kind === 'add') {
              return (
                <button
                  key="add"
                  type="button"
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  className="step-search-add"
                  onClick={handleAddSpeciality}
                >
                  New speciality “{query.trim()}”
                </button>
              );
            }
            return (
              <button
                key={option.name}
                type="button"
                id={optionId}
                role="option"
                aria-selected={isActive}
                className="step-search-speciality"
                onClick={() => handleSelectSpeciality({ name: option.name })}
              >
                <div className="step-search-speciality-title">{option.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpecialitySearchBase;
