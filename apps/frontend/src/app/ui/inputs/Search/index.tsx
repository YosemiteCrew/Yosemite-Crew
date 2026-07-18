import React, { useId } from 'react';
import { IoIosSearch } from 'react-icons/io';

type SearchProps = {
  value: string;
  setSearch: (value: string) => void;
  className?: string;
  placeholder?: string;
  label?: string;
  /** Forwarded to the underlying input so callers can focus it programmatically. */
  inputRef?: React.Ref<HTMLInputElement>;
  /** Fired when the input gains focus (e.g. to open a results dropdown). */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
};

const Search = ({
  value,
  setSearch,
  className,
  placeholder = 'Search',
  label = 'Search',
  inputRef,
  onFocus,
}: SearchProps) => {
  const inputId = useId();

  return (
    <div
      className={`${className ?? ''} h-[40px] w-60 xl:w-[280px] rounded-xl border-[1.5px]! border-input-border-default! bg-[var(--field-bg)] focus-within:border-input-border-active! px-[13px] flex items-center gap-[9px]`}
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <IoIosSearch
        size={15}
        color="var(--color-neutral-600)"
        className="shrink-0"
        aria-hidden="true"
      />
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={onFocus}
        className="font-satoshi outline-none border-0 w-full text-[12.5px] placeholder:text-neutral-600 text-text-primary"
        placeholder={placeholder}
      />
    </div>
  );
};

export default Search;
