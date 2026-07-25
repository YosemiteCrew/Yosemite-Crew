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
  /** Unfiltered option list. Part of the caller contract; the design's menu has
   *  no per-row dividers, so the panel itself only renders `filteredList`. */
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
      <div className="select-input-dropdown-search">
        <label htmlFor={searchInputId} className="sr-only">
          Search {placeholder}
        </label>
        <IoSearch size={13} color="var(--ink-faint)" className="shrink-0" aria-hidden="true" />
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
          placeholder={`Search ${placeholder}`}
          autoComplete="off"
        />
      </div>
    )}
    {filteredList.map((option, index: number) => {
      const label: string = option.label ?? option.value ?? '';
      const valueToSend: string = option.value ?? option.label ?? '';
      const isActive = activeOptionId === `${listboxId}-option-${valueToSend}`;
      return (
        <button
          key={valueToSend || label}
          id={`${listboxId}-option-${valueToSend}`}
          type="button"
          className={`select-input-dropdown-item ${isActive ? 'select-input-dropdown-item-active' : ''}`}
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
