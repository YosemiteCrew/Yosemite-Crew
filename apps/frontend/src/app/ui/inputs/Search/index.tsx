import React, { useId } from 'react';
import { IoIosSearch } from 'react-icons/io';

type SearchProps = {
  value: string;
  setSearch: (value: string) => void;
  className?: string;
  placeholder?: string;
  label?: string;
};

const Search = ({
  value,
  setSearch,
  className,
  placeholder = 'Search',
  label = 'Search',
}: SearchProps) => {
  const inputId = useId();

  return (
    <div
      className={`${className ?? ''} h-12 w-60 xl:w-[280px] rounded-2xl border! border-input-border-default! focus-within:border-input-border-active! px-6 flex items-center justify-center`}
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        className="font-satoshi outline-none border-0 w-full text-body-4 placeholder:text-text-secondary text-text-primary"
        placeholder={placeholder}
      />
      <IoIosSearch
        size={22}
        color="var(--color-neutral-900)"
        className="cursor-pointer"
        aria-hidden="true"
      />
    </div>
  );
};

export default Search;
