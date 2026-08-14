import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import classNames from 'classnames';
import { Icon } from '@/app/ui/icons/Icon';

import countries from '@/app/lib/data/countryList';
import DropdownPanel from './DropdownPanel';
import { useDropdownPositioning } from './useDropdownPositioning';
import { useDropdownKeyboardNav } from './useDropdownKeyboardNav';

import './Dropdown.css';

type DropdownType = 'country' | 'breed' | 'general';

type DropdownProps = {
  placeholder: string;
  value: string;
  onChange: (e: any) => void;
  error?: string;
  className?: string;
  dropdownClassName?: string;
  options?: Array<string | { label: string; value: string }>;
  type?: DropdownType;
  search?: boolean;
  disabled?: boolean;
  returnObject?: boolean;
  portal?: boolean;
};

const Dropdown = ({
  placeholder,
  onChange,
  value,
  error,
  className,
  dropdownClassName,
  options,
  type,
  search = false,
  disabled = false,
  returnObject = false,
  portal = true,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const errorId = useId();
  const searchInputId = useId();

  const list = useMemo(() => {
    if (type === 'country') {
      return countries.map((option) => ({
        key: option.code,
        label: `${option.flag} ${option.name}`,
        value: option.name,
      }));
    }
    if (type === 'breed') {
      return (options ?? []).map((option: any, index: number) => ({
        key: option.breedId ?? index,
        label: option.breedName ?? '',
        value: option.breedName ?? '',
      }));
    }
    return (options ?? []).map((option: any, index: number) => {
      if (typeof option === 'string') {
        return { key: option, label: option, value: option };
      }
      if (option && typeof option === 'object' && 'label' in option) {
        const val = option.value ?? option.label ?? index.toString();
        return {
          key: val ?? index,
          label: option.label ?? String(val),
          value: val ?? '',
        };
      }
      const str = String(option ?? index);
      return { key: index, label: str, value: str };
    });
  }, [options, type]);

  const [query, setQuery] = useState('');

  const filteredList = useMemo(() => {
    if (search) {
      return list.filter((item: any) =>
        (item.label || '').toLowerCase().includes(query.toLowerCase())
      );
    }
    return list;
  }, [list, query, search]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const inPortalDropdown = target.closest('[data-portal-dropdown]');
      if (dropdownRef.current && !dropdownRef.current.contains(target) && !inPortalDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shouldPortal = portal && typeof document !== 'undefined';

  const dismissForOuterScroll = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const { portalStyle } = useDropdownPositioning({
    open,
    portal,
    dropdownRef,
    onOuterScrollDismiss: dismissForOuterScroll,
  });

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const selected = list.find((opt: any) => opt.value === value);

  const selectOption = useCallback(
    (option: any) => {
      const valueToSend: string = option.value ?? option.label ?? '';
      onChange(returnObject ? option : valueToSend);
      setOpen(false);
      setQuery('');
    },
    [onChange, returnObject]
  );

  const { setActiveIndex, activeOptionId, handleKeyDown } = useDropdownKeyboardNav({
    open,
    setOpen,
    disabled,
    filteredList,
    value,
    listboxId,
    selectOption,
  });

  const panel = (
    <DropdownPanel
      listboxId={listboxId}
      placeholder={placeholder}
      shouldPortal={shouldPortal}
      dropdownClassName={dropdownClassName}
      portalStyle={portalStyle}
      search={search}
      searchInputId={searchInputId}
      query={query}
      setQuery={setQuery}
      handleKeyDown={handleKeyDown}
      activeOptionId={activeOptionId}
      filteredList={filteredList}
      setActiveIndex={setActiveIndex}
      selectOption={selectOption}
    />
  );

  return (
    <div className="select-wrapper">
      <span className="select-top-label">{placeholder}</span>
      <div className={classNames('select-container', { 'select-open': open })} ref={dropdownRef}>
        <button
          type="button"
          className={classNames(
            'select-input-container',
            { 'select-error': error, 'pointer-events-none opacity-60': disabled },
            className
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={selected ? `${placeholder}: ${selected.label}` : placeholder}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          <span className="select-input-selected">{selected ? selected.label : ''}</span>
          <span className="select-input-drop-icon" aria-hidden="true">
            <IoChevronDown color="var(--color-neutral-600)" size={14} />
          </span>
        </button>

        {open && !disabled && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !disabled && !shouldPortal && panel}
      </div>

      {error && (
        <div id={errorId} role="alert" className="Errors">
          <Icon icon="mdi:error" width="16" height="16" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
