'use client';
import React, { useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import { useDropdown } from '@/app/hooks/useDropdown';
import { useListboxKeyboardNav } from '@/app/ui/inputs/Dropdown/useDropdownKeyboardNav';
import { useDropdownPositioning } from '@/app/ui/inputs/Dropdown/useDropdownPositioning';
import { getFieldControlClassName } from '@/app/ui/fieldControlStyles';
import { Option } from '@/app/features/companions/types/companion';
import { TaskAudience } from '@/app/features/tasks/constants/taskTaxonomy';

/**
 * "Assign to" control from the New task design: one searchable dropdown, staff
 * and pet parents grouped under their own headers. Replaces the earlier chip
 * row - a hospital with a hundred staff rendered a hundred pills with no way
 * to search, and nothing distinguished a staff chip from a pet-parent chip but
 * an avatar shape a reader had to already know to look for. Picking a staff
 * row assigns to that team member (employee task); picking a pet-parent row
 * flips the task to a parent task assigned to that pet parent.
 */
type TaskAssigneeSelectProps = {
  teamOptions: Option[];
  parentOptions: Option[];
  audience: TaskAudience;
  assignedTo: string;
  onSelectTeam?: (option: Option) => void;
  onSelectParent?: (option: Option) => void;
  error?: string;
};

type AssigneeGroup = 'team' | 'parent';

type AssigneeEntry = {
  group: AssigneeGroup;
  option: Option;
  /** Unique across both lists even when a team id and a parent id collide. */
  key: string;
};

const getInitials = (label: string): string =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '--';

const toEntries = (options: Option[], group: AssigneeGroup): AssigneeEntry[] =>
  options.map((option) => ({ group, option, key: `${group}-${option.value}` }));

const matchesQuery = (option: Option, query: string): boolean =>
  option.label.toLowerCase().includes(query);

const triggerClassName = (open: boolean, hasErrorState: boolean): string => {
  const base = `relative flex h-10 w-full cursor-pointer items-center px-3 pr-9 ${getFieldControlClassName(hasErrorState)}`;
  if (open) return `${base} border-[var(--blue)]! shadow-[0_0_0_3px_var(--glow-b10)] z-20`;
  return base;
};

const optionClassName = (isActive: boolean): string =>
  `flex items-center gap-[9px] px-[11px] py-[7px] text-left text-[12.5px] font-semibold rounded-[8px]! w-full transition-colors hover:bg-[var(--nav-active-bg)] hover:text-[var(--nav-active)]! ${
    isActive ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]!' : 'text-[var(--ink-body)]!'
  }`;

const groupHeadingClassName =
  'px-[11px] pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-faint)] first:pt-1';

type OptionRowProps = {
  entry: AssigneeEntry;
  optionId: string;
  isActive: boolean;
  isSelected: boolean;
  onHover: () => void;
  onSelect: () => void;
};

/** The current pick, if any. `assignedTo` alone cannot tell a staff id from a
 * pet-parent id apart when the two happen to collide, so `audience` gates
 * which list is even searched - same rule the chip row this replaced used. */
const resolveSelectedEntry = (
  audience: TaskAudience,
  assignedTo: string,
  teamOptions: Option[],
  parentOptions: Option[]
): AssigneeEntry | null => {
  let group: AssigneeGroup | null = null;
  if (audience === 'EMPLOYEE_TASK') group = 'team';
  else if (audience === 'PARENT_TASK') group = 'parent';
  if (!group) return null;
  const option = (group === 'team' ? teamOptions : parentOptions).find(
    (o) => o.value === assignedTo
  );
  return option ? { group, option, key: `${group}-${option.value}` } : null;
};

const getTriggerLabel = (entry: AssigneeEntry | null): string => {
  if (!entry) return 'Assign to';
  const suffix = entry.group === 'parent' ? ' (pet parent)' : '';
  return `Assign to: ${entry.option.label}${suffix}`;
};

type AssigneeGroupSectionProps = {
  title: string;
  group: AssigneeGroup;
  options: Option[];
  listboxId: string;
  activeOptionId?: string;
  selectedKey?: string;
  filteredEntries: AssigneeEntry[];
  onHover: (index: number) => void;
  onSelect: (entry: AssigneeEntry) => void;
};

const AssigneeGroupSection = ({
  title,
  group,
  options,
  listboxId,
  activeOptionId,
  selectedKey,
  filteredEntries,
  onHover,
  onSelect,
}: AssigneeGroupSectionProps) => {
  if (options.length === 0) return null;
  return (
    // A <fieldset> maps to role=group in HTML-AAM (Sonar S6819), and its
    // <legend> supplies the accessible name without any ARIA plumbing - see
    // Slotpicker for the same pattern. Tailwind preflight already zeroes its
    // default margin/padding/border.
    <fieldset>
      <legend className={groupHeadingClassName}>{title}</legend>
      {options.map((option) => {
        const entry: AssigneeEntry = { group, option, key: `${group}-${option.value}` };
        const optionId = `${listboxId}-option-${entry.key}`;
        return (
          <OptionRow
            key={entry.key}
            entry={entry}
            optionId={optionId}
            isActive={activeOptionId === optionId}
            isSelected={entry.key === selectedKey}
            onHover={() => onHover(filteredEntries.findIndex((e) => e.key === entry.key))}
            onSelect={() => onSelect(entry)}
          />
        );
      })}
    </fieldset>
  );
};

type TriggerContentProps = {
  open: boolean;
  selectedEntry: AssigneeEntry | null;
  listboxId: string;
  searchQuery: string;
  activeOptionId?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent) => void;
  onChevronClick: () => void;
};

const TriggerContent = ({
  open,
  selectedEntry,
  listboxId,
  searchQuery,
  activeOptionId,
  inputRef,
  onSearchChange,
  onSearchKeyDown,
  onChevronClick,
}: TriggerContentProps) => (
  <>
    {open ? (
      <input
        ref={inputRef}
        id={`${listboxId}-search`}
        name={`${listboxId}-search`}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={selectedEntry ? selectedEntry.option.label : 'Search staff or pet parents'}
        aria-label="Search staff or pet parents"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        onKeyDown={(event) => {
          event.stopPropagation();
          onSearchKeyDown(event);
        }}
        className="w-full min-w-0 bg-transparent text-left text-[13px] text-[var(--ink-body)] focus-visible:outline-none placeholder:text-[var(--ink-faint)]"
      />
    ) : (
      <span
        className={`min-w-0 flex-1 truncate text-left text-[13px] ${
          selectedEntry ? 'text-[var(--ink-body)]' : 'text-[var(--ink-faint)]'
        }`}
      >
        {selectedEntry ? selectedEntry.option.label : 'Select staff or pet parent'}
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

const OptionRow = ({
  entry,
  optionId,
  isActive,
  isSelected,
  onHover,
  onSelect,
}: OptionRowProps) => (
  <button /* NOSONAR: WAI-ARIA combobox/listbox pattern (same as LabelDropdown, the shared dropdown every other control in this app uses) - no native <option> supports the avatar/dot rendering, search-filter combobox, or portalled popup this needs */
    key={entry.key}
    id={optionId}
    type="button"
    role="option"
    aria-selected={isSelected}
    className={optionClassName(isActive)}
    onMouseEnter={onHover}
    onClick={onSelect}
  >
    {entry.group === 'team' ? (
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--avatar-violet-bg)] text-[9px] font-bold text-[var(--avatar-violet-ink)]">
        {getInitials(entry.option.label)}
      </span>
    ) : (
      <span
        aria-hidden="true"
        className="mx-[7px] size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: 'var(--pink)' }}
      />
    )}
    <span className="min-w-0 truncate">{entry.option.label}</span>
  </button>
);

/**
 * Owns every piece of state and behaviour the control has: search filtering
 * across both lists, which entry is currently picked, keyboard navigation,
 * and portal positioning. Separated from TaskAssigneeSelect itself so that
 * component stays focused on composing the JSX from what this returns,
 * rather than mixing the two concerns in one function.
 */
const useAssigneeDropdown = ({
  teamOptions,
  parentOptions,
  audience,
  assignedTo,
  onSelectTeam,
  onSelectParent,
}: Pick<
  TaskAssigneeSelectProps,
  'teamOptions' | 'parentOptions' | 'audience' | 'assignedTo' | 'onSelectTeam' | 'onSelectParent'
>) => {
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
  } = useDropdown({ searchable: true });

  const query = searchQuery.trim().toLowerCase();
  const filteredTeam = useMemo(
    () => (query ? teamOptions.filter((o) => matchesQuery(o, query)) : teamOptions),
    [teamOptions, query]
  );
  const filteredParents = useMemo(
    () => (query ? parentOptions.filter((o) => matchesQuery(o, query)) : parentOptions),
    [parentOptions, query]
  );
  const filteredEntries = useMemo(
    () => [...toEntries(filteredTeam, 'team'), ...toEntries(filteredParents, 'parent')],
    [filteredTeam, filteredParents]
  );

  const selectedEntry = useMemo(
    () => resolveSelectedEntry(audience, assignedTo, teamOptions, parentOptions),
    [audience, assignedTo, teamOptions, parentOptions]
  );

  const selectEntry = useCallback(
    (entry: AssigneeEntry) => {
      if (entry.group === 'team') onSelectTeam?.(entry.option);
      else onSelectParent?.(entry.option);
      closeDropdown();
    },
    [onSelectTeam, onSelectParent, closeDropdown]
  );

  const { activeOptionId, setActiveIndex, handleKeyDown } = useListboxKeyboardNav({
    open,
    openDropdown,
    closeDropdown,
    options: filteredEntries,
    listboxId,
    selectionKey: `${audience}:${assignedTo}`,
    getOptionValue: (entry) => entry.key,
    isOptionSelected: (entry) => entry.key === selectedEntry?.key,
    selectOption: selectEntry,
    spaceSkipsInput: true,
  });

  const attachDropdownRef = useCallback(
    (node: HTMLDivElement | null) => {
      dropdownRef.current = node;
    },
    [dropdownRef]
  );

  const { portalStyle } = useDropdownPositioning({
    open,
    portal: true,
    dropdownRef,
    onOuterScrollDismiss: closeDropdown,
    topOffset: 4,
  });

  return {
    listboxId,
    open,
    searchQuery,
    setSearchQuery,
    inputRef,
    openDropdown,
    toggleDropdown,
    filteredTeam,
    filteredParents,
    filteredEntries,
    selectedEntry,
    selectEntry,
    activeOptionId,
    setActiveIndex,
    handleKeyDown,
    attachDropdownRef,
    portalStyle,
    nothingToShow: filteredEntries.length === 0,
    emptyMessage: query ? 'No matches found' : 'No assignees available yet.',
  };
};

const TaskAssigneeSelect = ({
  teamOptions,
  parentOptions,
  audience,
  assignedTo,
  onSelectTeam,
  onSelectParent,
  error,
}: TaskAssigneeSelectProps) => {
  const hasOptions = teamOptions.length > 0 || parentOptions.length > 0;
  const controlId = useId();
  const errorId = error ? `${controlId}-message` : undefined;

  const {
    listboxId,
    open,
    searchQuery,
    setSearchQuery,
    inputRef,
    openDropdown,
    toggleDropdown,
    filteredTeam,
    filteredParents,
    filteredEntries,
    selectedEntry,
    selectEntry,
    activeOptionId,
    setActiveIndex,
    handleKeyDown,
    attachDropdownRef,
    portalStyle,
    nothingToShow,
    emptyMessage,
  } = useAssigneeDropdown({
    teamOptions,
    parentOptions,
    audience,
    assignedTo,
    onSelectTeam,
    onSelectParent,
  });
  const shouldPortal = typeof document !== 'undefined';

  const panelNode = (
    <div /* NOSONAR: WAI-ARIA combobox/listbox pattern (same as LabelDropdown, the shared dropdown every other control in this app uses) - a native <select>/<datalist> cannot render grouped headers, avatar/dot rows, or a portalled floating panel */
      id={listboxId}
      role="listbox"
      aria-label="Assign to"
      data-portal-dropdown
      className="max-h-[240px] overflow-y-auto scrollbar-hidden z-200 rounded-[13px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_24px_60px_var(--sh28)] flex flex-col items-stretch gap-px w-full p-1.5"
      style={shouldPortal ? (portalStyle ?? undefined) : undefined}
    >
      <AssigneeGroupSection
        title="Staff"
        group="team"
        options={filteredTeam}
        listboxId={listboxId}
        activeOptionId={activeOptionId}
        selectedKey={selectedEntry?.key}
        filteredEntries={filteredEntries}
        onHover={setActiveIndex}
        onSelect={selectEntry}
      />
      <AssigneeGroupSection
        title="Pet parents"
        group="parent"
        options={filteredParents}
        listboxId={listboxId}
        activeOptionId={activeOptionId}
        selectedKey={selectedEntry?.key}
        filteredEntries={filteredEntries}
        onHover={setActiveIndex}
        onSelect={selectEntry}
      />
      {nothingToShow && (
        <div className="py-[7px] text-center text-[12.5px] font-medium text-[var(--ink-faint)]">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  const triggerLabel = getTriggerLabel(selectedEntry);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-[var(--ink-soft)]">Assign to</span>
      {hasOptions ? (
        <div className="w-full relative" ref={attachDropdownRef}>
          <button
            id={controlId}
            type="button"
            className={triggerClassName(open, Boolean(error))}
            onClick={() => {
              if (!open) openDropdown();
            }}
            aria-label={triggerLabel}
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-haspopup="listbox"
            aria-describedby={errorId}
            onKeyDown={handleKeyDown}
          >
            <TriggerContent
              open={open}
              selectedEntry={selectedEntry}
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
      ) : (
        <span className="text-[12.5px] text-[var(--ink-faint)]">No assignees available yet.</span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-[12px] text-text-error">
          {error}
        </span>
      )}
    </div>
  );
};

export default TaskAssigneeSelect;
