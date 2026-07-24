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
      className={`${className ?? ''} h-[38px] w-60 xl:w-[280px] rounded-full! border! border-[var(--hairline)]! bg-[var(--field-bg)] focus-within:border-[var(--blue)]! focus-within:shadow-[0_0_0_3px_var(--glow-b10)] transition-[border-color,box-shadow] px-[14px] flex items-center gap-[9px]`}
    >
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <IoIosSearch size={15} color="var(--ink-faint)" className="shrink-0" aria-hidden="true" />
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={onFocus}
        className="font-satoshi outline-none border-0 w-full text-[13px] placeholder:text-[var(--ink-faint)] text-[var(--ink-body)] bg-transparent"
        placeholder={placeholder}
      />
    </div>
  );
};

export default Search;
