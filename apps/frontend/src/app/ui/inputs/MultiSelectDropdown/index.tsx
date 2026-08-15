import React, { useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IoIosWarning } from 'react-icons/io';
import { Option } from '@/app/features/companions/types/companion';
import { IoCheckmarkOutline, IoChevronDown } from 'react-icons/io5';
import { useDropdown, useFilteredOptions } from '@/app/hooks/useDropdown';
import { useListboxKeyboardNav } from '@/app/ui/inputs/Dropdown/useDropdownKeyboardNav';
import { useDropdownPositioning } from '@/app/ui/inputs/Dropdown/useDropdownPositioning';

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
    className="border-[var(--blue)] max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-[12px] border border-t bg-[var(--glass-93)] shadow-[0_16px_34px_var(--sh12)] backdrop-blur-[24px] backdrop-saturate-150 flex flex-col items-stretch w-full px-3 py-2.5"
    style={shouldPortal && portalStyle ? portalStyle : undefined}
  >
    {filteredOptions.length > 0 ? (
      filteredOptions.map((option) => {
        const isSelected = valueSet.has(option.value);
        return (
          <button
            type="button"
            id={`${listboxId}-option-${option.value}`}
            aria-pressed={isSelected}
            className={`flex items-center justify-between gap-2 px-5 py-2 text-left text-[13px] hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full ${
              activeOptionId === `${listboxId}-option-${option.value}`
                ? 'bg-card-hover text-text-primary!'
                : ''
            }`}
            key={option.value}
            onMouseEnter={() => onActiveIndexChange(filteredOptions.indexOf(option))}
            onClick={() => onToggleOption(option)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 truncate">{option.label}</span>
              {option.badge && (
                <span className="shrink-0 rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
                  {option.badge}
                </span>
              )}
            </span>
            {isSelected && (
              <IoCheckmarkOutline
                size={14}
                className="shrink-0 text-text-brand"
                aria-hidden="true"
              />
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
    'relative w-full flex h-[44px] items-center px-[14px] pr-11 min-w-30 border-[1.5px] cursor-pointer bg-[var(--field-bg)] text-[14px] outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)]';
  let borderState: string;
  if (open) {
    borderState = 'border-[var(--blue)]! border-b-0! rounded-t-[12px]! z-20';
  } else if (!hasSelection && error) {
    borderState = 'border-[var(--danger)]! rounded-[12px]!';
  } else {
    borderState = 'border-[var(--hairline)]! rounded-[12px]!';
  }
  return `${base} ${borderState}`;
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
        className="w-full bg-transparent text-left text-[14px] text-[var(--ink-body)] outline-none placeholder:text-[var(--ink-faint)]"
      />
    );
  }
  return (
    <span
      className="min-w-0 flex-1 truncate text-left text-[14px] text-[var(--ink-body)]"
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

  const { portalStyle } = useDropdownPositioning({
    open,
    portal,
    dropdownRef,
    onOuterScrollDismiss: closeDropdown,
  });

  const toggleOption = useCallback(
    (option: Option) => {
      const isSelected = valueSet.has(option.value);
      const next = isSelected ? value.filter((v) => v !== option.value) : [...value, option.value];
      onChange(next);
    },
    [onChange, value, valueSet]
  );

  const { activeOptionId, setActiveIndex, handleKeyDown } = useListboxKeyboardNav({
    open,
    openDropdown,
    closeDropdown,
    options: filteredOptions,
    listboxId,
    selectionKey: valueSet,
    getOptionValue: (option) => option.value,
    isOptionSelected: (option) => valueSet.has(option.value),
    selectOption: toggleOption,
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
      <span className="mb-1.5 flex items-center gap-1 truncate text-[12.5px] font-semibold text-[var(--ink-soft)]">
        {icon}
        {placeholder}
      </span>
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
                toggleDropdown();
              }}
            />
          </span>
        </button>
        {open && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !shouldPortal && <div className="absolute top-full left-0 w-full">{panel}</div>}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
