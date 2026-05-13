import React, { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import { IoIosWarning } from 'react-icons/io';
import { useDropdown, useFilteredOptions, DropdownOption } from '@/app/hooks/useDropdown';

type DropdownProps = {
  placeholder: string;
  options: DropdownOption[];
  defaultOption?: string;
  onSelect: (option: DropdownOption) => void;
  error?: string;
  hasError?: boolean;
  searchable?: boolean;
  icon?: React.ReactNode;
  portal?: boolean;
  noOptionsMessage?: string;
};

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;

const getFloatingLabelStyle = (isFloated: boolean): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-satoshi), sans-serif',
    fontWeight: 400,
    lineHeight: '120%',
  };
  if (isFloated) {
    return {
      ...baseStyle,
      top: 0,
      transform: 'translateY(-50%)',
      fontSize: 12,
      color: 'var(--color-neutral-900)',
    };
  }
  return {
    ...baseStyle,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 16,
    color: 'var(--color-input-text-placeholder)',
  };
};

const LabelDropdown = ({
  placeholder,
  options,
  defaultOption,
  onSelect,
  error,
  hasError,
  searchable = true,
  icon,
  portal = true,
  noOptionsMessage,
}: DropdownProps) => {
  const [selected, setSelected] = useState<DropdownOption | null>(null);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const listboxId = useId();
  const triggerLabel = selected ? `${placeholder}: ${selected.label}` : placeholder;
  const {
    open,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    inputRef,
    openDropdown,
    toggleDropdown,
    closeDropdown,
  } = useDropdown({ searchable });

  useEffect(() => {
    if (defaultOption === undefined) {
      setSelected(null);
      return;
    }
    const found = options.find(
      (option) => option.value === defaultOption || option.label === defaultOption
    );
    if (found) {
      setSelected(found);
    } else {
      setSelected(null);
    }
  }, [defaultOption, options]);

  const filteredOptions = useFilteredOptions(options, searchQuery);
  const shouldPortal = portal && typeof document !== 'undefined';

  const computeStyle = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportHeight = globalThis.window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const panelMaxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow - 8)
    );
    setPortalStyle({
      position: 'absolute',
      left: rect.left + globalThis.window.scrollX,
      width: rect.width,
      top: rect.bottom + globalThis.window.scrollY - 1,
      maxHeight: panelMaxHeight,
      zIndex: 5000,
    });
  }, [dropdownRef]);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalStyle(null);
      return;
    }
    computeStyle();
  }, [computeStyle, open, portal]);

  useEffect(() => {
    if (!open || !portal) return;
    const handleOuterScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-portal-dropdown]')) return;
      closeDropdown();
    };
    globalThis.window.addEventListener('resize', computeStyle);
    globalThis.window.addEventListener('scroll', handleOuterScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', computeStyle);
      globalThis.window.removeEventListener('scroll', handleOuterScroll, true);
    };
  }, [closeDropdown, computeStyle, open, portal]);

  // Same visual style for both portal and inline — connected panel below trigger
  const panel = (
    <div
      id={listboxId}
      aria-label={placeholder}
      data-portal-dropdown
      className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-2xl border border-t bg-white flex flex-col items-stretch w-full px-3 py-2.5"
      style={shouldPortal ? (portalStyle ?? undefined) : undefined}
    >
      {filteredOptions.length > 0 &&
        filteredOptions.map((option, i) => (
          <button
            key={option.value + i}
            type="button"
            aria-pressed={selected?.value === option.value}
            className="px-5 py-3 text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
            onClick={() => {
              setSelected(option);
              onSelect(option);
              closeDropdown();
            }}
          >
            {option.label}
          </button>
        ))}
      {filteredOptions.length === 0 && (
        <div className="text-caption-1 py-3 text-text-primary text-center">
          {searchQuery ? 'No matches found' : (noOptionsMessage ?? 'No options')}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <div className="w-full relative" ref={dropdownRef}>
        <button
          type="button"
          className={`relative w-full flex min-h-12 items-center px-5 pr-11 py-2.75 min-w-30 border cursor-pointer bg-(--whitebg) focus-visible:outline-none! ${open ? 'border-input-text-placeholder-active! rounded-t-2xl! z-20' : 'border-input-border-default! rounded-2xl!'} ${error || hasError ? 'border-input-border-error!' : ''}`}
          onClick={() => {
            if (!open) {
              openDropdown();
            }
          }}
          aria-label={triggerLabel}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
        >
          {open && searchable && (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={selected ? selected.label : ''}
              className="w-full min-w-0 bg-transparent text-left text-body-4 text-black-text focus-visible:outline-none placeholder:text-input-text-placeholder"
            />
          )}
          {(!open || !searchable) && selected && (
            <span className="min-w-0 flex-1 text-left text-black-text text-body-4 truncate">
              {selected.label}
            </span>
          )}
          <span className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <IoChevronDown
              size={15}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: 'var(--color-input-text-placeholder-active)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown();
              }}
            />
          </span>
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 z-30 flex items-center gap-1 bg-(--whitebg) px-1 transition-all duration-150"
          style={getFloatingLabelStyle(Boolean(selected) || open)}
        >
          {icon}
          {placeholder}
        </span>
        {open && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !shouldPortal && <div className="absolute top-full left-0 w-full">{panel}</div>}
      </div>
      {error && (
        <div
          className={`
            min-h-6 mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
            `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default LabelDropdown;
