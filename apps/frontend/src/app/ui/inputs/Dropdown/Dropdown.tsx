import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { FaSortDown } from 'react-icons/fa';
import { IoSearch } from 'react-icons/io5';
import classNames from 'classnames';
import { Icon } from '@iconify/react/dist/iconify.js';

import countries from '@/app/lib/data/countryList';

import './Dropdown.css';

type DropdownType = 'country' | 'breed' | 'general' | undefined;

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

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;

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
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
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

  const computePortalStyle = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportHeight = globalThis.window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const panelMaxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow - 8)
    );
    setPortalStyle({
      position: 'absolute',
      left: rect.left + globalThis.window.scrollX,
      width: rect.width,
      top: rect.bottom + globalThis.window.scrollY - 1,
      maxHeight: panelMaxHeight,
      zIndex: 5000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalStyle(null);
      return;
    }
    computePortalStyle();
  }, [computePortalStyle, open, portal]);

  useEffect(() => {
    if (!open || !portal) return;
    const handleOuterScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-portal-dropdown]')) return;
      setOpen(false);
      setQuery('');
    };
    globalThis.window.addEventListener('resize', computePortalStyle);
    globalThis.window.addEventListener('scroll', handleOuterScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', computePortalStyle);
      globalThis.window.removeEventListener('scroll', handleOuterScroll, true);
    };
  }, [computePortalStyle, open, portal]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const isActive = open || !!value;
  const selected = list.find((opt: any) => opt.value === value);

  const panel = (
    <div
      id={listboxId}
      aria-label={placeholder}
      data-portal-dropdown
      className={`select-input-dropdown ${shouldPortal ? 'select-input-dropdown-portal' : ''} ${dropdownClassName ?? ''}`}
      style={shouldPortal ? (portalStyle ?? undefined) : undefined}
    >
      {search && (
        <div className="h-12! rounded-2xl border! border-input-border-default! px-4! py-2! flex items-center justify-center">
          <label htmlFor={searchInputId} className="sr-only">
            Search {placeholder}
          </label>
          <input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 text-[16px]! w-full px-2 focus-visible:outline-none"
            placeholder={`Search ${placeholder}`}
            autoComplete="off"
          />
          <IoSearch
            size={22}
            color="var(--color-neutral-200)"
            className="cursor-pointer"
            aria-hidden="true"
          />
        </div>
      )}
      {filteredList.map((option: any, index: number) => {
        const label: string = option.label ?? option.value ?? '';
        const valueToSend: string = option.value ?? option.label ?? '';
        const isSelected = valueToSend === value;
        return (
          <button
            key={label + 'team-key' + index}
            type="button"
            aria-pressed={isSelected}
            className={`select-input-dropdown-item ${index === list.length - 1 ? '' : 'border-b border-grey-light'}`}
            onClick={() => {
              onChange(returnObject ? option : valueToSend);
              setOpen(false);
              setQuery('');
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="select-wrapper">
      <div
        className={classNames('select-container floating-input', { focused: isActive })}
        ref={dropdownRef}
      >
        <button
          type="button"
          className={classNames(
            'select-input-container',
            { blueborder: value, 'pointer-events-none opacity-70': disabled },
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
        >
          {selected && <div className="select-input-selected">{selected.label}</div>}
          <div className="select-input-drop-icon" aria-hidden="true">
            <FaSortDown color="var(--color-neutral-600)" size={20} />
          </div>
        </button>
        <label className="select-floating-label" aria-hidden="true">
          {placeholder}
        </label>

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
