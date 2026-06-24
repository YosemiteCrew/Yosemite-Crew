import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoIosSearch, IoIosWarning } from 'react-icons/io';

type OptionProps = {
  value: string;
  label: string;
  meta?: unknown;
};

type SearchDropdownProps = {
  options: OptionProps[];
  onSelect: (e: any) => void;
  placeholder: string;
  query: string;
  setQuery: (v: string) => void;
  label?: string;
  minChars?: number;
  error?: string;
  onReachEnd?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  renderOption?: (option: OptionProps) => React.ReactNode;
  optionClassName?: string;
};

const SearchDropdown = ({
  onSelect,
  options,
  placeholder,
  query,
  setQuery,
  label,
  minChars = 2,
  error,
  onReachEnd,
  hasMore = false,
  isLoadingMore = false,
  renderOption,
  optionClassName,
}: SearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [hasSelected, setHasSelected] = useState(false);
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();
  const accessibleLabel = label ?? placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((s: OptionProps) => s.label.toLowerCase().includes(q) || !q);
  }, [query, options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || filtered.length === 0 || query.length < minChars) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => (current >= 0 && current < filtered.length ? current : 0));
  }, [filtered, minChars, open, query.length]);

  const activeOptionId =
    activeIndex >= 0 && activeIndex < filtered.length
      ? `${listboxId}-option-${filtered[activeIndex].value}`
      : undefined;

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const onSelectOption = (key: string) => {
    onSelect(key);
    setHasSelected(true);
    setOpen(false);
  };

  const canSearch = open && query.length >= minChars && filtered.length > 0;

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      if (filtered.length === 0 || query.length < minChars) return;
      setActiveIndex((current) => (current + 1 >= filtered.length ? 0 : current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (filtered.length === 0 || query.length < minChars) return;
      setActiveIndex((current) => (current <= 0 ? filtered.length - 1 : current - 1));
      return;
    }
    if (event.key === 'Home' && canSearch) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End' && canSearch) {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
      return;
    }
    if (event.key !== 'Enter' || !canSearch) return;
    if (activeIndex < 0 || activeIndex >= filtered.length) return;
    event.preventDefault();
    onSelectOption(filtered[activeIndex].value);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onReachEnd || !hasMore || isLoadingMore) return;
    const node = e.currentTarget;
    if (node.scrollHeight - node.scrollTop - node.clientHeight <= 24) {
      onReachEnd();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor={inputId} className="sr-only">
        {accessibleLabel}
      </label>
      <div
        className={`h-12 border px-4 py-2.5 flex items-center justify-center w-full focus-within:border-input-border-active! ${canSearch ? 'border-input-border-active! border-b-0! rounded-t-2xl!' : 'border-input-border-default! rounded-2xl!'}`}
      >
        <input
          id={inputId}
          type="text"
          aria-label={accessibleLabel}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          aria-controls={canSearch ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          className="border-0 text-body-4 text-text-primary w-full placeholder:text-input-text-placeholder placeholder:text-body-4 focus-visible:outline-none"
          placeholder={placeholder}
          autoComplete="off"
        />
        <IoIosSearch
          size={22}
          color="var(--color-neutral-900)"
          className="cursor-pointer"
          aria-hidden="true"
        />
      </div>

      {canSearch && (
        <div
          id={listboxId}
          aria-label={accessibleLabel}
          className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-99 absolute top-full left-0 rounded-b-2xl border-l border-r border-b border-t bg-white flex flex-col items-center w-full px-3 py-2.5"
          onScroll={handleScroll}
        >
          {filtered.map((option) => (
            <button
              type="button"
              key={option.value}
              id={`${listboxId}-option-${option.value}`}
              onMouseEnter={() => setActiveIndex(filtered.indexOf(option))}
              onClick={() => onSelectOption(option.value)}
              className={
                optionClassName ??
                `px-5 py-3 text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full text-start ${
                  activeOptionId === `${listboxId}-option-${option.value}`
                    ? 'bg-card-hover text-text-primary!'
                    : ''
                }`
              }
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          ))}
          {isLoadingMore ? (
            <output
              aria-live="polite"
              className="text-caption-1 py-2 text-text-secondary w-full text-center"
            >
              Loading more results…
            </output>
          ) : null}
        </div>
      )}

      {!open && error && !hasSelected && (
        <div
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error"
        >
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
