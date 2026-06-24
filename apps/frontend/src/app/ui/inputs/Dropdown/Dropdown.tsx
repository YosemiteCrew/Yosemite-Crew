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

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;

/** Wrap the active option index when navigating with the arrow keys. */
const wrapActiveIndex = (current: number, optionCount: number, delta: 1 | -1): number => {
  if (delta === 1) return current + 1 >= optionCount ? 0 : current + 1;
  return current <= 0 ? optionCount - 1 : current - 1;
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
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
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
  const activeOptionId =
    activeIndex >= 0 && activeIndex < filteredList.length
      ? `${listboxId}-option-${filteredList[activeIndex].value}`
      : undefined;

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

  const computePortalStyleRef = useRef(computePortalStyle);
  computePortalStyleRef.current = computePortalStyle;

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalStyle(null);
      return;
    }
    computePortalStyleRef.current();
  }, [open, portal]);

  useEffect(() => {
    if (!open || !portal) return;
    const stableResize = () => computePortalStyleRef.current();
    const handleOuterScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-portal-dropdown]')) return;
      setOpen(false);
      setQuery('');
    };
    globalThis.window.addEventListener('resize', stableResize);
    globalThis.window.addEventListener('scroll', handleOuterScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', stableResize);
      globalThis.window.removeEventListener('scroll', handleOuterScroll, true);
    };
  }, [open, portal]);

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

  useEffect(() => {
    if (!open || filteredList.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current >= 0 && current < filteredList.length) return current;
      const selectedIndex = filteredList.findIndex((option: any) => option.value === value);
      return Math.max(selectedIndex, 0);
    });
  }, [filteredList, open, value]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const selectOption = useCallback(
    (option: any) => {
      const valueToSend: string = option.value ?? option.label ?? '';
      onChange(returnObject ? option : valueToSend);
      setOpen(false);
      setQuery('');
    },
    [onChange, returnObject]
  );

  const handleArrowKey = useCallback(
    (delta: 1 | -1) => {
      const optionCount = filteredList.length;
      if (optionCount === 0) return;
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => wrapActiveIndex(current, optionCount, delta));
    },
    [filteredList.length, open]
  );

  const handleConfirmKey = useCallback(() => {
    const optionCount = filteredList.length;
    if (!open) {
      setOpen(true);
      return;
    }
    if (activeIndex < 0 || activeIndex >= optionCount) return;
    selectOption(filteredList[activeIndex]);
  }, [activeIndex, filteredList, open, selectOption]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      const optionCount = filteredList.length;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setOpen(false);
          return;
        case 'ArrowDown':
          event.preventDefault();
          handleArrowKey(1);
          return;
        case 'ArrowUp':
          event.preventDefault();
          handleArrowKey(-1);
          return;
        case 'Home':
          if (!open || optionCount === 0) return;
          event.preventDefault();
          setActiveIndex(0);
          return;
        case 'End':
          if (!open || optionCount === 0) return;
          event.preventDefault();
          setActiveIndex(optionCount - 1);
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleConfirmKey();
          return;
        default:
      }
    },
    [disabled, filteredList.length, handleArrowKey, handleConfirmKey, open]
  );

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
            aria-label={`Search ${placeholder}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              handleKeyDown(event);
            }}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
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
        return (
          <button
            key={valueToSend || label}
            id={`${listboxId}-option-${valueToSend}`}
            type="button"
            className={`select-input-dropdown-item ${index === list.length - 1 ? '' : 'border-b border-grey-light'} ${
              activeOptionId === `${listboxId}-option-${valueToSend}` ? 'bg-card-hover' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectOption(option)}
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
          onKeyDown={handleKeyDown}
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
