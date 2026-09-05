import React, { useCallback, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import { IoIosWarning } from 'react-icons/io';
import { useDropdown, useFilteredOptions, DropdownOption } from '@/app/hooks/useDropdown';
import { useListboxKeyboardNav } from './useDropdownKeyboardNav';
import { useDropdownPositioning } from './useDropdownPositioning';
import { deriveEmptyLabel } from '@/app/ui/inputs/Dropdown/emptyLabel';

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
  /** Text shown while nothing is selected. Defaults to `Select <placeholder>`. */
  emptyLabel?: string;
  /**
   * Locks the control. Needed because `internalSelected` is deliberately the
   * source of truth for the visible label (see the comment on it), so a caller
   * that merely ignores `onSelect` still gets a trigger that opens and a label
   * that moves - showing an answer the record does not contain.
   */
  disabled?: boolean;
  /**
   * Drop the stacked label above the trigger, for callers that supply their own
   * (the workspace meta bar renders it as a `legend` notched into the field
   * border). The trigger's `aria-label` already carries "<label>: <value>", so
   * nothing is lost - and omitting the element beats hiding it with CSS, which
   * leaves the same text in the accessibility tree and renders twice the moment
   * the selector stops matching.
   */
  hideLabel?: boolean;
};

const TERMINOLOGY_LOCK_SELECTOR = "[data-terminology-lock='true']";

const findDropdownOption = (options: DropdownOption[], defaultOption?: string) => {
  if (defaultOption === undefined) return null;
  return (
    options.find((option) => option.value === defaultOption || option.label === defaultOption) ??
    null
  );
};

// Design select trigger: 46px tall, 0 13px padding (right side widened for the
// chevron), 13px radius, 1.5px --hairline, warm --field-bg, 13px value text.
const triggerClassName = (open: boolean, hasErrorState: boolean): string => {
  const base =
    'relative w-full flex h-[44px] items-center px-[13px] pr-9 min-w-30 rounded-[12px]! border-[1.5px] cursor-pointer bg-[var(--field-bg)] text-[13px] outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)]';
  if (open) return `${base} border-[var(--blue)]! shadow-[0_0_0_3px_var(--glow-b10)] z-20`;
  const border = hasErrorState ? 'border-[var(--danger)]!' : 'border-[var(--hairline)]!';
  return `${base} ${border}`;
};

// Design menu row: 7px 11px padding, 8px radius, 12.5px / 600, --ink-body,
// active/hover on the warm --nav-active-bg wash.
const optionClassName = (isActive: boolean): string =>
  `flex items-center justify-between gap-2 px-[11px] py-[7px] text-left text-[12.5px] font-semibold rounded-[8px]! w-full transition-colors hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-active)]! ${
    isActive ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]!' : 'text-[var(--ink-body)]!'
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
  const emptyMessage = searchQuery
    ? 'No matches found'
    : (noOptionsMessage ?? 'No options available');
  return (
    <div
      id={listboxId}
      aria-label={placeholder}
      data-portal-dropdown
      data-terminology-lock={isTerminologyLocked ? 'true' : undefined}
      className="max-h-[200px] overflow-y-auto scrollbar-hidden z-200 rounded-[13px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_24px_60px_var(--sh28)] flex flex-col items-stretch gap-px w-full p-1.5"
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
              <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-text-brand">
                {option.badge}
              </span>
            )}
          </button>
        ))}
      {filteredOptions.length === 0 && (
        <div className="py-[7px] text-center text-[12.5px] font-medium text-[var(--ink-faint)]">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};

type DropdownTriggerContentProps = {
  open: boolean;
  searchable: boolean;
  selected: DropdownOption | null;
  placeholder: string;
  /** Shown while nothing is selected. Distinct from the stacked label above. */
  emptyLabel: string;
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
  emptyLabel,
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
        placeholder={selected ? selected.label : emptyLabel}
        aria-label={`Search ${placeholder}`}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        onKeyDown={(event) => {
          event.stopPropagation();
          onSearchKeyDown(event);
        }}
        className="w-full min-w-0 bg-transparent text-left text-[13px] text-[var(--ink-body)] focus-visible:outline-none placeholder:text-[var(--ink-faint)]"
      />
    )}
    {(!open || !searchable) && (
      // A select with nothing chosen shows its placeholder in --ink-faint, never
      // an empty box: the design makes the placeholder mandatory on every select,
      // and 159 triggers across the product rendered blank until something was
      // picked, so a required field looked identical to a filled one. The text is
      // "Select <label>", not the label itself, so it never repeats the stacked
      // label sitting directly above it.
      <span
        className={`min-w-0 flex-1 truncate text-left text-[13px] ${
          selected ? 'text-[var(--ink-body)]' : 'text-[var(--ink-faint)]'
        }`}
      >
        {selected ? selected.label : emptyLabel}
      </span>
    )}
    <span className="absolute right-[13px] top-1/2 -translate-y-1/2 flex items-center justify-center">
      <IoChevronDown
        size={13}
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
  disabled = false,
  hideLabel = false,
  emptyLabel,
}: DropdownProps) => {
  const [internalSelected, setInternalSelected] = useState<DropdownOption | null>(() =>
    findDropdownOption(options, defaultOption)
  );
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
  // Terminology locks are static wrapper attributes, so measuring once when the
  // trigger mounts is enough; the portal panel re-applies the marker itself.
  const [isTerminologyLocked, setIsTerminologyLocked] = useState(false);
  const attachDropdownRef = useCallback(
    (node: HTMLDivElement | null) => {
      dropdownRef.current = node;
      setIsTerminologyLocked(Boolean(node?.closest(TERMINOLOGY_LOCK_SELECTOR)));
    },
    [dropdownRef]
  );

  const { portalStyle } = useDropdownPositioning({
    open,
    portal,
    dropdownRef,
    onOuterScrollDismiss: closeDropdown,
    // Design detaches the menu from the trigger by 4px.
    topOffset: 4,
  });

  const selectOption = useCallback(
    (option: DropdownOption) => {
      setInternalSelected(option);
      onSelect(option);
      closeDropdown();
    },
    [closeDropdown, onSelect]
  );

  const { activeOptionId, setActiveIndex, handleKeyDown } = useListboxKeyboardNav({
    open,
    openDropdown,
    closeDropdown,
    options: filteredOptions,
    listboxId,
    selectionKey: selected?.value,
    getOptionValue: (option) => option.value,
    isOptionSelected: (option) => option.value === selected?.value,
    selectOption,
  });

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
      {!hideLabel && (
        <span className="mb-1.5 flex items-center gap-1 truncate text-[12px] font-semibold text-[var(--ink-soft)]">
          {icon}
          {placeholder}
        </span>
      )}
      <div className="w-full relative" ref={attachDropdownRef}>
        <button
          type="button"
          disabled={disabled}
          className={triggerClassName(open, Boolean(error || hasError))}
          onClick={() => {
            if (disabled) return;
            if (!open) {
              openDropdown();
            }
          }}
          aria-label={triggerLabel}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-haspopup="listbox"
          onKeyDown={disabled ? undefined : handleKeyDown}
        >
          <DropdownTriggerContent
            open={open}
            searchable={searchable}
            selected={selected}
            placeholder={placeholder}
            emptyLabel={emptyLabel ?? deriveEmptyLabel(placeholder)}
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
          <div className="absolute top-full left-0 mt-1 w-full">{panelNode}</div>
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
