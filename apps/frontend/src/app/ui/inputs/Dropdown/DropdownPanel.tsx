import React from 'react';
import { IoSearch } from 'react-icons/io5';
import type { DropdownOption } from './dropdownHelpers';

type DropdownPanelProps = {
  listboxId: string;
  placeholder: string;
  shouldPortal: boolean;
  dropdownClassName?: string;
  portalStyle: React.CSSProperties | null;
  search: boolean;
  searchInputId: string;
  query: string;
  setQuery: (value: string) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  activeOptionId: string | undefined;
  filteredList: DropdownOption[];
  list: DropdownOption[];
  setActiveIndex: (index: number) => void;
  selectOption: (option: DropdownOption) => void;
};

const DropdownPanel = ({
  listboxId,
  placeholder,
  shouldPortal,
  dropdownClassName,
  portalStyle,
  search,
  searchInputId,
  query,
  setQuery,
  handleKeyDown,
  activeOptionId,
  filteredList,
  list,
  setActiveIndex,
  selectOption,
}: DropdownPanelProps) => (
  <div
    id={listboxId}
    aria-label={placeholder}
    data-portal-dropdown
    className={`select-input-dropdown ${shouldPortal ? 'select-input-dropdown-portal' : ''} ${dropdownClassName ?? ''}`}
    style={shouldPortal ? (portalStyle ?? undefined) : undefined}
  >
    {search && (
      <div className="h-[40px]! rounded-xl border-[1.5px]! border-input-border-default! bg-[var(--field-bg)] px-[13px]! flex items-center gap-[9px]">
        <label htmlFor={searchInputId} className="sr-only">
          Search {placeholder}
        </label>
        <IoSearch
          size={15}
          color="var(--color-neutral-600)"
          className="shrink-0"
          aria-hidden="true"
        />
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
          className="border-0 text-[12.5px]! w-full focus-visible:outline-none placeholder:text-neutral-600"
          placeholder={`Search ${placeholder}`}
          autoComplete="off"
        />
      </div>
    )}
    {filteredList.map((option, index: number) => {
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

export default DropdownPanel;
