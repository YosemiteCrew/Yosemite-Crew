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

/** Compute the active option index when the open/options/selection context changes. */
const resolveActiveIndex = (
  open: boolean,
  options: DropdownOption[],
  activeIndex: number,
  selectedValue?: string
): number => {
  if (!open || options.length === 0) return -1;
  if (activeIndex >= 0 && activeIndex < options.length) return activeIndex;
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  return Math.max(selectedIndex, 0);
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

const triggerClassName = (open: boolean, hasErrorState: boolean): string => {
  const base =
    'relative w-full flex h-[46px] items-center px-[14px] pr-11 min-w-30 border-[1.5px] cursor-pointer bg-[var(--field-bg)] text-[14px] outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)]';
  if (open) return `${base} border-[var(--blue)]! border-b-0! rounded-t-[12px]! z-20`;
  const border = hasErrorState ? 'border-[var(--danger)]!' : 'border-[var(--hairline)]!';
  return `${base} rounded-[12px]! ${border}`;
};

const optionClassName = (isActive: boolean): string =>
  `flex items-center justify-between gap-2 px-5 py-3 text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full ${
    isActive ? 'bg-card-hover text-text-primary!' : ''
  }`;

type DropdownPanelProps = {
  listboxId: string;
  placeholder: string;
  isTerminologyLocked: boolean;
  shouldPortal: boolean;
  portalStyle: React.CSSProperties | null;
  filteredOptions: DropdownOption[];
  activeOptionId?: string;
  searchQuery: string;
  noOptionsMessage?: string;
  onOptionHover: (option: DropdownOption) => void;
  onOptionSelect: (option: DropdownOption) => void;
};

const DropdownPanel = ({
  listboxId,
  placeholder,
  isTerminologyLocked,
  shouldPortal,
  portalStyle,
  filteredOptions,
  activeOptionId,
  searchQuery,
  noOptionsMessage,
  onOptionHover,
  onOptionSelect,
}: DropdownPanelProps) => {
  const emptyMessage = searchQuery ? 'No matches found' : (noOptionsMessage ?? 'No options');
  return (
    <div
      id={listboxId}
      aria-label={placeholder}
      data-portal-dropdown
      data-terminology-lock={isTerminologyLocked ? 'true' : undefined}
      className="border-[var(--blue)] max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-xl border border-t bg-[var(--glass-93)] shadow-[0_16px_34px_var(--sh12)] backdrop-blur-[24px] backdrop-saturate-150 flex flex-col items-stretch w-full px-3 py-2.5"
      style={shouldPortal ? (portalStyle ?? undefined) : undefined}
    >
      {filteredOptions.length > 0 &&
        filteredOptions.map((option) => (
          <button
            key={option.value}
            id={`${listboxId}-option-${option.value}`}
            type="button"
            className={optionClassName(activeOptionId === `${listboxId}-option-${option.value}`)}
            onMouseEnter={() => onOptionHover(option)}
            onClick={() => onOptionSelect(option)}
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
        <div className="text-caption-1 py-3 text-text-primary text-center">{emptyMessage}</div>
      )}
    </div>
  );
};

type DropdownTriggerContentProps = {
  open: boolean;
  searchable: boolean;
  selected: DropdownOption | null;
  placeholder: string;
  listboxId: string;
  searchQuery: string;
  activeOptionId?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent) => void;
  onChevronClick: () => void;
};

const DropdownTriggerContent = ({
  open,
  searchable,
  selected,
  placeholder,
  listboxId,
  searchQuery,
  activeOptionId,
  inputRef,
  onSearchChange,
  onSearchKeyDown,
  onChevronClick,
}: DropdownTriggerContentProps) => (
  <>
    {open && searchable && (
      <input
        ref={inputRef}
        id={`${listboxId}-search`}
        name={`${listboxId}-search`}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={selected ? selected.label : ''}
        aria-label={`Search ${placeholder}`}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        onKeyDown={(event) => {
          event.stopPropagation();
          onSearchKeyDown(event);
        }}
        className="w-full min-w-0 bg-transparent text-left text-[14px] text-[var(--ink-body)] focus-visible:outline-none placeholder:text-[var(--ink-faint)]"
      />
    )}
    {(!open || !searchable) && selected && (
      <span className="min-w-0 flex-1 text-left text-[var(--ink-body)] text-[14px] truncate">
        {selected.label}
      </span>
    )}
    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
      <IoChevronDown
        size={14}
        aria-hidden="true"
        style={{
          flexShrink: 0,
          color: 'var(--ink-faint)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onChevronClick();
        }}
      />
    </span>
  </>
);

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
  const [internalSelected, setInternalSelected] = useState<DropdownOption | null>(() =>
    findDropdownOption(options, defaultOption)
  );
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const controlledSelected = findDropdownOption(options, defaultOption);
  // `internalSelected` is the single source of truth so a user click always moves
  // the label (selectOption sets it), even when a controlled parent never echoes
  // the chosen value back into `defaultOption`. When the external default (or the
  // options that resolve it) changes — async loads, a parent reset/cancel — the
  // render-time guard re-syncs, mirroring the activeIndex pattern below.
  const [syncedValue, setSyncedValue] = useState(controlledSelected?.value);
  if (controlledSelected?.value !== syncedValue) {
    setSyncedValue(controlledSelected?.value);
    setInternalSelected(controlledSelected);
  }
  const selected = internalSelected;
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

  const [activeIndexDeps, setActiveIndexDeps] = useState({
    filteredOptions,
    open,
    selectedValue: selected?.value,
  });
  if (
    filteredOptions !== activeIndexDeps.filteredOptions ||
    open !== activeIndexDeps.open ||
    selected?.value !== activeIndexDeps.selectedValue
  ) {
    setActiveIndexDeps({ filteredOptions, open, selectedValue: selected?.value });
    setActiveIndex(resolveActiveIndex(open, filteredOptions, activeIndex, selected?.value));
  }

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
  const panelNode = (
    <DropdownPanel
      listboxId={listboxId}
      placeholder={placeholder}
      isTerminologyLocked={isTerminologyLocked}
      shouldPortal={shouldPortal}
      portalStyle={portalStyle}
      filteredOptions={filteredOptions}
      activeOptionId={activeOptionId}
      searchQuery={searchQuery}
      noOptionsMessage={noOptionsMessage}
      onOptionHover={(option) => setActiveIndex(filteredOptions.indexOf(option))}
      onOptionSelect={selectOption}
    />
  );

  return (
    <div className="flex flex-col w-full">
      <span className="mb-1.5 flex items-center gap-1 truncate text-[12.5px] font-semibold text-[var(--ink-soft)]">
        {icon}
        {placeholder}
      </span>
      <div className="w-full relative" ref={dropdownRef}>
        <button
          type="button"
          className={triggerClassName(open, Boolean(error || hasError))}
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
          <DropdownTriggerContent
            open={open}
            searchable={searchable}
            selected={selected}
            placeholder={placeholder}
            listboxId={listboxId}
            searchQuery={searchQuery}
            activeOptionId={activeOptionId}
            inputRef={inputRef}
            onSearchChange={setSearchQuery}
            onSearchKeyDown={handleKeyDown}
            onChevronClick={toggleDropdown}
          />
        </button>
        {open && shouldPortal && portalStyle && createPortal(panelNode, document.body)}
        {open && !shouldPortal && (
          <div className="absolute top-full left-0 w-full">{panelNode}</div>
        )}
      </div>
      {error && (
        <div className="min-h-6 mt-1.5 flex items-center gap-1 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default LabelDropdown;
