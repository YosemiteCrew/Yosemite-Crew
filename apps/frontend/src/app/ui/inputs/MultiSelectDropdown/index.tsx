import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IoIosWarning } from 'react-icons/io';
import { Option } from '@/app/features/companions/types/companion';
import { IoChevronDown } from 'react-icons/io5';
import { FiCheck } from 'react-icons/fi';
import { useDropdown, useFilteredOptions } from '@/app/hooks/useDropdown';

type DropdownProps = {
  placeholder: string;
  value: string[];
  onChange: (e: string[]) => void;
  error?: string;
  options?: Array<string | { label: string; value: string; badge?: string }>;
  searchable?: boolean;
  icon?: React.ReactNode;
  portal?: boolean;
};

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;

/** Wrap the active option index when navigating with the arrow keys. */
const wrapActiveIndex = (current: number, optionCount: number, delta: 1 | -1): number => {
  if (delta === 1) return current + 1 >= optionCount ? 0 : current + 1;
  return current <= 0 ? optionCount - 1 : current - 1;
};

const usePortalPositioning = (
  dropdownRef: React.RefObject<HTMLDivElement | null>,
  open: boolean,
  portal: boolean,
  closeDropdown: () => void
) => {
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties | null>(null);

  const computeStyle = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = globalThis.window.innerHeight - rect.bottom;
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

  return portalStyle;
};

type ActiveOptionArgs = {
  open: boolean;
  listboxId: string;
  filteredOptions: Option[];
  valueSet: Set<string>;
  openDropdown: () => void;
  closeDropdown: () => void;
  toggleOption: (option: Option) => void;
};

const useActiveOption = ({
  open,
  listboxId,
  filteredOptions,
  valueSet,
  openDropdown,
  closeDropdown,
  toggleOption,
}: ActiveOptionArgs) => {
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const activeOptionId =
    activeIndex >= 0 && activeIndex < filteredOptions.length
      ? `${listboxId}-option-${filteredOptions[activeIndex].value}`
      : undefined;

  useEffect(() => {
    if (!open || filteredOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current >= 0 && current < filteredOptions.length) return current;
      const selectedIndex = filteredOptions.findIndex((option) => valueSet.has(option.value));
      return Math.max(selectedIndex, 0);
    });
  }, [filteredOptions, open, valueSet]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

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
    toggleOption(filteredOptions[activeIndex]);
  }, [activeIndex, filteredOptions, open, openDropdown, toggleOption]);

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

  return { activeIndex, activeOptionId, setActiveIndex, handleKeyDown };
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

type MultiSelectPanelProps = {
  listboxId: string;
  filteredOptions: Option[];
  valueSet: Set<string>;
  searchQuery: string;
  activeOptionId?: string;
  shouldPortal: boolean;
  portalStyle: React.CSSProperties | null;
  onActiveIndexChange: (index: number) => void;
  onToggleOption: (option: Option) => void;
};

const MultiSelectPanel = ({
  listboxId,
  filteredOptions,
  valueSet,
  searchQuery,
  activeOptionId,
  shouldPortal,
  portalStyle,
  onActiveIndexChange,
  onToggleOption,
}: MultiSelectPanelProps) => (
  <div
    id={listboxId}
    data-portal-dropdown
    className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-2xl border border-t bg-white flex flex-col items-stretch w-full px-3 py-2.5"
    style={shouldPortal ? (portalStyle ?? undefined) : undefined}
  >
    {filteredOptions.length > 0 ? (
      filteredOptions.map((option) => {
        const isSelected = valueSet.has(option.value);
        return (
          <button
            type="button"
            id={`${listboxId}-option-${option.value}`}
            aria-pressed={isSelected}
            className={`px-3 py-2 text-left text-body-4 hover:bg-card-hover rounded-lg text-text-primary w-full flex items-center justify-between gap-2 ${
              activeOptionId === `${listboxId}-option-${option.value}` ? 'bg-card-hover' : ''
            }`}
            key={option.value}
            onMouseEnter={() => onActiveIndexChange(filteredOptions.indexOf(option))}
            onClick={() => onToggleOption(option)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{option.label}</span>
              {option.badge && (
                <span className="shrink-0 rounded-full bg-card-hover px-2 py-0.5 text-caption-2 text-text-secondary">
                  {option.badge}
                </span>
              )}
            </span>
            {isSelected && (
              <FiCheck size={14} className="shrink-0 text-text-brand" aria-hidden="true" />
            )}
          </button>
        );
      })
    ) : (
      <div className="text-caption-1 py-3 text-text-primary text-center">
        {searchQuery ? 'No matches found' : 'No options available'}
      </div>
    )}
  </div>
);

const getTriggerClassName = (open: boolean, hasSelection: boolean, error?: string): string => {
  const base =
    'relative w-full flex min-h-12 items-center px-5 pr-11 py-2.75 min-w-30 border cursor-pointer bg-(--whitebg)';
  const borderState = open
    ? 'border-input-text-placeholder-active! rounded-t-2xl!'
    : 'border-input-border-default! rounded-2xl!';
  const errorState = !hasSelection && error ? 'border-input-border-error!' : '';
  return `${base} ${borderState} ${errorState}`;
};

type TriggerContentProps = {
  open: boolean;
  searchable: boolean;
  hasSelection: boolean;
  selectedLabel: string;
  placeholder: string;
  searchId: string;
  listboxId: string;
  searchQuery: string;
  activeOptionId: string | undefined;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
};

const MultiSelectTriggerContent = ({
  open,
  searchable,
  hasSelection,
  selectedLabel,
  placeholder,
  searchId,
  listboxId,
  searchQuery,
  activeOptionId,
  inputRef,
  onSearchChange,
  onKeyDown,
}: TriggerContentProps) => {
  if (open && searchable) {
    return (
      <input
        ref={inputRef}
        id={searchId}
        name={searchId}
        type="text"
        aria-label={`Search ${placeholder}`}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          onKeyDown(event);
        }}
        placeholder={hasSelection ? selectedLabel : ''}
        className="w-full bg-transparent text-left text-body-4 text-black-text outline-none placeholder:text-input-text-placeholder"
      />
    );
  }
  return (
    <span
      className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap scrollbar-hidden text-left text-body-4 text-black-text"
      title={hasSelection ? selectedLabel : placeholder}
    >
      {hasSelection ? selectedLabel : ''}
    </span>
  );
};

const MultiSelectDropdown = ({
  placeholder,
  onChange,
  value,
  error,
  options,
  searchable = true,
  icon,
  portal = true,
}: DropdownProps) => {
  const searchId = useId();
  const listboxId = useId();
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
  const list: Option[] = useMemo(() => {
    return (
      options?.map((opt) => (typeof opt === 'string' ? { label: opt, value: opt } : opt)) ?? []
    );
  }, [options]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const selectedOptions = useMemo(
    () => list.filter((opt) => valueSet.has(opt.value)),
    [list, valueSet]
  );
  const selectedLabel = selectedOptions.map((opt) => opt.label).join(', ');
  const hasSelection = selectedOptions.length > 0;

  const filteredOptions = useFilteredOptions(list, searchQuery);
  const shouldPortal = portal && typeof document !== 'undefined';

  const portalStyle = usePortalPositioning(dropdownRef, open, portal, closeDropdown);

  const toggleOption = useCallback(
    (option: Option) => {
      const isSelected = valueSet.has(option.value);
      const next = isSelected ? value.filter((v) => v !== option.value) : [...value, option.value];
      onChange(next);
    },
    [onChange, value, valueSet]
  );

  const { activeOptionId, setActiveIndex, handleKeyDown } = useActiveOption({
    open,
    listboxId,
    filteredOptions,
    valueSet,
    openDropdown,
    closeDropdown,
    toggleOption,
  });

  const panel = (
    <MultiSelectPanel
      listboxId={listboxId}
      filteredOptions={filteredOptions}
      valueSet={valueSet}
      searchQuery={searchQuery}
      activeOptionId={activeOptionId}
      shouldPortal={shouldPortal}
      portalStyle={portalStyle}
      onActiveIndexChange={setActiveIndex}
      onToggleOption={toggleOption}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          aria-label={hasSelection ? `${placeholder}: ${selectedLabel}` : placeholder}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          className={getTriggerClassName(open, hasSelection, error)}
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (!open) {
              openDropdown();
            }
          }}
        >
          <MultiSelectTriggerContent
            open={open}
            searchable={searchable}
            hasSelection={hasSelection}
            selectedLabel={selectedLabel}
            placeholder={placeholder}
            searchId={searchId}
            listboxId={listboxId}
            searchQuery={searchQuery}
            activeOptionId={activeOptionId}
            inputRef={inputRef}
            onSearchChange={setSearchQuery}
            onKeyDown={handleKeyDown}
          />
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
          style={getFloatingLabelStyle(hasSelection || open)}
        >
          {icon}
          {placeholder}
        </span>
        {open && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !shouldPortal && <div className="absolute top-full left-0 w-full">{panel}</div>}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
