import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { specialtiesByKey } from '@/app/lib/specialities';
import { Service } from '@yosemite-crew/types';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useListboxKeyboardNav } from '@/app/ui/inputs/Dropdown/useDropdownKeyboardNav';

import './ServiceSearch.css';

type ServiceSearchBaseProps = {
  speciality: SpecialityWeb;
  onSelectService: (serviceName: string) => void | Promise<void>;
  onAddService: (serviceName: string) => void | Promise<void>;
};

/** One row of the results listbox: a matching service, or the single "add new" row shown when nothing matches. */
type ServiceOption = { id: string; kind: 'service'; name: string } | { id: 'add'; kind: 'add' };

const ServiceSearchBase = ({
  speciality,
  onSelectService,
  onAddService,
}: ServiceSearchBaseProps) => {
  const uid = useId();
  const inputId = `service-search-input-${uid}`;
  const listboxId = `service-search-listbox-${uid}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const services = useMemo(
    () => specialtiesByKey[speciality.name]?.services || [],
    [speciality.name]
  );

  const selectedNames = useMemo(
    () => new Set((speciality.services || []).map((s: Service) => s.name.toLowerCase())),
    [speciality]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s: any) => {
      const name = s.toLowerCase();
      if (selectedNames.has(name)) return false;
      if (!q) return true;
      return name.includes(q);
    });
  }, [query, selectedNames, services]);

  const listOptions: ServiceOption[] = useMemo(
    () =>
      filtered.length > 0
        ? filtered.map((name: string, index: number) => ({
            id: String(index),
            kind: 'service' as const,
            name,
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

  const handleSelect = async (serviceName: string) => {
    await onSelectService(serviceName);
    setQuery('');
    setOpen(false);
  };

  const handleAdd = async () => {
    const name = query.trim();
    if (!name) return;
    await onAddService(name);
    setQuery('');
    setOpen(false);
  };

  const selectOption = (option: ServiceOption) => {
    if (option.kind === 'add') {
      void handleAdd();
    } else {
      void handleSelect(option.name);
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
    <div className="service-search" ref={wrapperRef}>
      <IoSearch size={15} className="service-search-icon" color="var(--color-text-tertiary)" />
      <input
        type="text"
        id={inputId}
        name={inputId}
        placeholder="Search or create service"
        aria-label="Search or create service"
        className="service-search-input"
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
          className="service-search-dropdown"
          id={listboxId}
          role="listbox"
          aria-label="Service results"
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
                  className="service-search-add"
                  onClick={handleAdd}
                >
                  Add service “{query.trim()}”
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
                className="service-search-speciality"
                onClick={() => handleSelect(option.name)}
              >
                <div className="service-search-speciality-title">{option.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiceSearchBase;
