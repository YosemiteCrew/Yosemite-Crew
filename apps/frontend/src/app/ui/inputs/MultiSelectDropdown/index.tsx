import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IoIosWarning } from 'react-icons/io';
import { Option } from '@/app/features/companions/types/companion';
import { IoChevronDown } from 'react-icons/io5';
import { useDropdown, useFilteredOptions } from '@/app/hooks/useDropdown';

type DropdownProps = {
  placeholder: string;
  value: string[];
  onChange: (e: string[]) => void;
  error?: string;
  options?: Array<string | { label: string; value: string }>;
  searchable?: boolean;
  icon?: React.ReactNode;
  portal?: boolean;
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

type MultiSelectPanelProps = {
  filteredOptions: Option[];
  valueSet: Set<string>;
  searchQuery: string;
  shouldPortal: boolean;
  portalStyle: React.CSSProperties | null;
  onToggleOption: (option: Option) => void;
};

const MultiSelectPanel = ({
  filteredOptions,
  valueSet,
  searchQuery,
  shouldPortal,
  portalStyle,
  onToggleOption,
}: MultiSelectPanelProps) => (
  <div
    data-portal-dropdown
    className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-200 rounded-b-2xl border border-t bg-white flex flex-col items-stretch w-full px-3 py-2.5"
    style={shouldPortal ? (portalStyle ?? undefined) : undefined}
  >
    {filteredOptions.length > 0 ? (
      filteredOptions.map((option, index: number) => {
        const isSelected = valueSet.has(option.value);
        return (
          <button
            type="button"
            aria-pressed={isSelected}
            className={`px-3 py-2 text-left text-body-4 hover:bg-card-hover rounded-lg hover:text-text-primary w-full ${
              isSelected ? 'bg-blue-light text-blue-text font-medium' : 'text-text-secondary'
            }`}
            key={option.value + index}
            onClick={() => onToggleOption(option)}
          >
            {option.label}
          </button>
        );
      })
    ) : (
      <div className="text-caption-1 py-3 text-text-primary text-center">
        {searchQuery ? 'No matches found' : 'No options available'}
      </div>
    )}
  </div>
);

const MultiSelectDropdown = ({
  placeholder,
  onChange,
  value,
  error,
  options,
  searchable = true,
  icon,
  portal = true,
}: DropdownProps) => {
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
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties | null>(null);

  const list: Option[] = useMemo(() => {
    return (
      options?.map((opt) => (typeof opt === 'string' ? { label: opt, value: opt } : opt)) ?? []
    );
  }, [options]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const selectedOptions = useMemo(
    () => list.filter((opt) => valueSet.has(opt.value)),
    [list, valueSet]
  );
  const selectedLabel = selectedOptions.map((opt) => opt.label).join(', ');
  const hasSelection = selectedOptions.length > 0;

  const filteredOptions = useFilteredOptions(list, searchQuery);
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

  const toggleOption = (option: Option) => {
    const isSelected = valueSet.has(option.value);
    const next = isSelected ? value.filter((v) => v !== option.value) : [...value, option.value];
    onChange(next);
    closeDropdown();
  };

  const panel = (
    <MultiSelectPanel
      filteredOptions={filteredOptions}
      valueSet={valueSet}
      searchQuery={searchQuery}
      shouldPortal={shouldPortal}
      portalStyle={portalStyle}
      onToggleOption={toggleOption}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          aria-label={hasSelection ? `${placeholder}: ${selectedLabel}` : placeholder}
          aria-expanded={open}
          className={`relative w-full flex min-h-12 items-center px-5 pr-11 py-2.75 min-w-30 border cursor-pointer bg-(--whitebg) ${open ? 'border-input-text-placeholder-active! rounded-t-2xl!' : 'border-input-border-default! rounded-2xl!'} ${!hasSelection && error ? 'border-input-border-error!' : ''}`}
          onClick={() => {
            if (!open) {
              openDropdown();
            }
          }}
        >
          {open && searchable ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={hasSelection ? selectedLabel : ''}
              className="w-full bg-transparent text-left text-body-4 text-black-text outline-none placeholder:text-input-text-placeholder"
            />
          ) : (
            <span
              className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap scrollbar-hidden text-left text-body-4 text-black-text"
              title={hasSelection ? selectedLabel : placeholder}
            >
              {hasSelection ? selectedLabel : ''}
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
          style={getFloatingLabelStyle(hasSelection || open)}
        >
          {icon}
          {placeholder}
        </span>
        {open && shouldPortal && portalStyle && createPortal(panel, document.body)}
        {open && !shouldPortal && <div className="absolute top-full left-0 w-full">{panel}</div>}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
