import React from 'react';
import { IoIosSearch } from 'react-icons/io';
import { FiX } from 'react-icons/fi';
import type { SearchResult } from './specialityAccordionHelpers';

type SpecialitySearchBarProps = {
  searchRef: React.RefObject<HTMLDivElement | null>;
  specialityName: string;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[];
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onSelectResult: (result: SearchResult) => void;
};

const SpecialitySearchBar = ({
  searchRef,
  specialityName,
  searchQuery,
  searchOpen,
  searchResults,
  onQueryChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClear,
  onSelectResult,
}: SpecialitySearchBarProps) => (
  <div ref={searchRef} className="relative w-full sm:w-64 sm:ml-auto shrink-0">
    <div className="flex items-center gap-2 border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-[var(--field-bg)] w-full">
      <input
        type="text"
        placeholder="Search services & packages..."
        value={searchQuery}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
        aria-label={`Search within ${specialityName}`}
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="shrink-0 focus-visible:outline-none"
        >
          <FiX size={12} color="var(--color-text-secondary)" />
        </button>
      )}
      <IoIosSearch
        size={20}
        color="var(--color-neutral-900)"
        aria-hidden="true"
        className="shrink-0"
      />
    </div>

    {searchOpen && searchQuery.trim() && (
      <div className="absolute top-full left-0 sm:left-auto sm:right-0 z-50 mt-1 w-full sm:w-96 bg-[var(--screen)] border border-card-border rounded-2xl shadow-lg overflow-hidden">
        {searchResults.length > 0 ? (
          searchResults.map((result) => (
            <button
              key={result.id}
              type="button"
              onMouseDown={() => onSelectResult(result)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-card-hover transition-colors"
            >
              <span className="text-[13px] text-text-primary truncate">{result.name}</span>
              <span className="text-[12px] text-text-secondary shrink-0">{result.meta}</span>
            </button>
          ))
        ) : (
          <div className="px-4 py-2 text-[13px] text-text-secondary">No results found.</div>
        )}
      </div>
    )}
  </div>
);

export default SpecialitySearchBar;
