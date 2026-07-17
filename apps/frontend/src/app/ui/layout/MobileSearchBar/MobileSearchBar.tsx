'use client';
import React, { useId } from 'react';
import { IoIosSearch } from 'react-icons/io';
import { useSearchStore } from '@/app/stores/searchStore';

type MobileSearchBarProps = {
  placeholder?: string;
};

const MobileSearchBar = ({ placeholder = 'Search' }: MobileSearchBarProps) => {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const inputId = useId();

  return (
    <div className="lg:hidden flex items-center gap-2 w-full border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-neutral-0">
      <label className="sr-only" htmlFor={inputId}>
        {placeholder}
      </label>
      <input
        id={inputId}
        type="search"
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
      />
      <IoIosSearch
        size={18}
        color="var(--color-neutral-500)"
        aria-hidden="true"
        className="shrink-0"
      />
    </div>
  );
};

export default MobileSearchBar;
