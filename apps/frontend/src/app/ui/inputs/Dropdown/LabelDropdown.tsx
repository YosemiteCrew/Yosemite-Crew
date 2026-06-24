import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import { IoIosWarning } from 'react-icons/io';
import { useDropdown, useFilteredOptions, DropdownOption } from '@/app/hooks/useDropdown';

type DropdownProps = {
  placeholder: string;
  options: DropdownOption[];
  defaultOption?: string;
  onSelect: (option: DropdownOption) => void;
  error?: string;
  hasError?: boolean;
  searchable?: boolean;
  icon?: React.ReactNode;
  portal?: boolean;
  noOptionsMessage?: string;
};

/** Wrap the active option index when navigating with the arrow keys. */
const wrapActiveIndex = (current: number, optionCount: number, delta: 1 | -1): number => {
  if (delta === 1) return current + 1 >= optionCount ? 0 : current + 1;
  return current <= 0 ? optionCount - 1 : current - 1;
};

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;
const TERMINOLOGY_LOCK_SELECTOR = "[data-terminology-lock='true']";

const findDropdownOption = (options: DropdownOption[], defaultOption?: string) => {
  if (defaultOption === undefined) return null;
  return (
    options.find((option) => option.value === defaultOption || option.label === defaultOption) ??
    null
  );
};

const getFloatingLabelStyle = (isFloated: boolean): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-satoshi), sans-serif',
    fontWeight: 400,
    lineHeight: '120%',
  };
  if (isFloated) {
    return {
      ...baseStyle,
      top: 0,
      transform: 'translateY(-50%)',
      fontSize: 12,
      color: 'var(--color-neutral-900)',
    };
  }
  return {
    ...baseStyle,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 16,
    color: 'var(--color-input-text-placeholder)',
  };
};

const LabelDropdown = ({
  placeholder,
  options,
  defaultOption,
  onSelect,
  error,
  hasError,
  searchable = true,
  icon,
  portal = true,
  noOptionsMessage,
}: DropdownProps) => {
  const [internalSelected, setInternalSelected] = useState<DropdownOption | null>(null);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const controlledSelected = findDropdownOption(options, defaultOption);
  const selected = defaultOption === undefined ? internalSelected : controlledSelected;
  const triggerLabel = selected ? `${placeholder}: ${selected.label}` : placeholder;
  const {
    open,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    inputRef,
    openDropdown,
    toggleDropdown,
    closeDropdown,
  } = useDropdown({ searchable });

  const filteredOptions = useFilteredOptions(options, searchQuery);
  const shouldPortal = portal && typeof document !== 'undefined';
  const isTerminologyLocked = Boolean(dropdownRef.current?.closest(TERMINOLOGY_LOCK_SELECTOR));
  const activeOptionId =
    activeIndex >= 0 && activeIndex < filteredOptions.length
      ? `${listboxId}-option-${filteredOptions[activeIndex].value}`
      : undefined;

  const computeStyle = useCallback(() => {
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
  }, [dropdownRef]);

  const computeStyleRef = useRef(computeStyle);
  computeStyleRef.current = computeStyle;

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalStyle(null);
      return;
    }
    computeStyleRef.current();
  }, [open, portal]);

  useEffect(() => {
    if (!open || !portal) return;
    const stableResize = () => computeStyleRef.current();
    const handleOuterScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-portal-dropdown]')) return;
      closeDropdown();
    };
    globalThis.window.addEventListener('resize', stableResize);
    globalThis.window.addEventListener('scroll', handleOuterScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', stableResize);
      globalThis.window.removeEventListener('scroll', handleOuterScroll, true);
    };
  }, [closeDropdown, open, portal]);

  useEffect(() => {
    if (!open || filteredOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current >= 0 && current < filteredOptions.length) return current;
      const selectedIndex = filteredOptions.findIndex((option) => option.value === selected?.value);
      return Math.max(selectedIndex, 0);
    });
  }, [filteredOptions, open, selected?.value]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    const activeElement = document.getElementById(activeOptionId);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const selectOption = useCallback(
    (option: DropdownOption) => {
      setInternalSelected(option);
      onSelect(option);
      closeDropdown();
    },
    [closeDropdown, onSelect]
  );

  const handleArrowKey = useCallback(
    (delta: 1 | -1) => {
      const optionCount = filteredOptions.length;
      if (optionCount === 0) return;
      if (!open) {
        openDropdown();
        return;
      }
      setActiveIndex((current) => wrapActiveIndex(current, optionCount, delta));
    },
    [filteredOptions.length, open, openDropdown]
  );

  const handleConfirmKey = useCallback(() => {
    const optionCount = filteredOptions.length;
    if (!open) {
      openDropdown();
      return;
    }
    if (activeIndex < 0 || activeIndex >= optionCount) return;
    selectOption(filteredOptions[activeIndex]);
  }, [activeIndex, filteredOptions, open, openDropdown, selectOption]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const optionCount = filteredOptions.length;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeDropdown();
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
    [closeDropdown, filteredOptions.length, handleArrowKey, handleConfirmKey, open]
  );

  // Same visual style for both portal and inline — connected panel below trigger
  const panel = (
    <div
      id={listboxId}
      aria-label={placeholder}
      data-portal-dropdown
      data-terminology-lock={isTerminologyLocked ? 'true' : undefined}
      className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-2xl border border-t bg-white flex flex-col items-stretch w-full px-3 py-2.5"
      style={shouldPortal ? (portalStyle ?? undefined) : undefined}
    >
      {filteredOptions.length > 0 &&
        filteredOptions.map((option) => (
          <button
            key={option.value}
            id={`${listboxId}-option-${option.value}`}
            type="button"
            className={`flex items-center justify-between gap-2 px-5 py-3 text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full ${
              activeOptionId === `${listboxId}-option-${option.value}`
                ? 'bg-card-hover text-text-primary!'
                : ''
            }`}
            onMouseEnter={() => setActiveIndex(filteredOptions.indexOf(option))}
            onClick={() => selectOption(option)}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            {option.badge && (
              <span className="shrink-0 rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
                {option.badge}
              </span>
            )}
          </button>
        ))}
      {filteredOptions.length === 0 && (
        <div className="text-caption-1 py-3 text-text-primary text-center">
          {searchQuery ? 'No matches found' : (noOptionsMessage ?? 'No options')}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <div className="w-full relative" ref={dropdownRef}>
        <button
          type="button"
          className={`relative w-full flex min-h-12 items-center px-5 pr-11 py-2.75 min-w-30 border cursor-pointer bg-(--whitebg) focus-visible:outline-none! ${open ? 'border-input-text-placeholder-active! border-b-0! rounded-t-2xl! z-20' : 'border-input-border-default! rounded-2xl!'} ${error || hasError ? 'border-input-border-error!' : ''}`}
          onClick={() => {
            if (!open) {
              openDropdown();
            }
          }}
          aria-label={triggerLabel}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-haspopup="listbox"
          onKeyDown={handleKeyDown}
        >
          {open && searchable && (
            <input
              ref={inputRef}
              id={`${listboxId}-search`}
              name={`${listboxId}-search`}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={selected ? selected.label : ''}
              aria-label={`Search ${placeholder}`}
              aria-controls={open ? listboxId : undefined}
              aria-activedescendant={activeOptionId}
              onKeyDown={(event) => {
                event.stopPropagation();
                handleKeyDown(event);
              }}
              className="w-full min-w-0 bg-transparent text-left text-body-4 text-black-text focus-visible:outline-none placeholder:text-input-text-placeholder"
            />
          )}
          {(!open || !searchable) && selected && (
            <span className="min-w-0 flex-1 text-left text-black-text text-body-4 truncate">
              {selected.label}
            </span>
          )}
          <span className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <IoChevronDown
              size={15}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: 'var(--color-input-text-placeholder-active)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown();
              }}
            />
          </span>
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 z-30 flex items-center gap-1 bg-(--whitebg) px-1 transition-all duration-150"
          style={getFloatingLabelStyle(Boolean(selected) || open)}
        >
          {icon}
          {placeholder}
        </span>
        {open && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !shouldPortal && <div className="absolute top-full left-0 w-full">{panel}</div>}
      </div>
      {error && (
        <div
          className={`
            min-h-6 mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
            `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default LabelDropdown;
