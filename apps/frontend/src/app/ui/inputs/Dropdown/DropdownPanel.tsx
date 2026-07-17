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
