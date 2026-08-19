import { useCallback, useEffect, useState } from 'react';
import { wrapActiveIndex } from './dropdownHelpers';

type DropdownOption = { key: string | number; label: string; value: string };

export type ListboxKeyboardNavArgs<T> = {
  open: boolean;
  openDropdown: () => void;
  closeDropdown: () => void;
  /** Ignore every key while the control is disabled. */
  disabled?: boolean;
  options: T[];
  listboxId: string;
  /** Identity of the current selection; when it changes the active index re-syncs. */
  selectionKey: unknown;
  /** Id-suffix used for the option's DOM id (`${listboxId}-option-${...}`). */
  getOptionValue: (option: T) => string;
  /** Seeds the active index from the currently selected option. */
  isOptionSelected: (option: T) => boolean;
  selectOption: (option: T) => void;
  /** Searchable variant only: Space typed into the query input must type, not confirm. */
  spaceSkipsInput?: boolean;
};

/**
 * Shared roving keyboard navigation for every dropdown/listbox variant: owns
 * the active-option index, keeps it in sync with the option list / open state
 * / selection (adjusted during render, per React's "you might not need an
 * effect" guidance — kept as-is, not converted to a reducer), scrolls the
 * active option into view, and handles ArrowUp/ArrowDown, Home/End,
 * Enter/Space, and Escape.
 */
export function useListboxKeyboardNav<T>({
  open,
  openDropdown,
  closeDropdown,
  disabled = false,
  options,
  listboxId,
  selectionKey,
  getOptionValue,
  isOptionSelected,
  selectOption,
  spaceSkipsInput = false,
}: ListboxKeyboardNavArgs<T>) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeOptionId =
    activeIndex >= 0 && activeIndex < options.length
      ? `${listboxId}-option-${getOptionValue(options[activeIndex])}`
      : undefined;

  const [activeIndexDeps, setActiveIndexDeps] = useState({ options, open, selectionKey });
  if (
    options !== activeIndexDeps.options ||
    open !== activeIndexDeps.open ||
    selectionKey !== activeIndexDeps.selectionKey
  ) {
    setActiveIndexDeps({ options, open, selectionKey });
    if (!open || options.length === 0) {
      setActiveIndex(-1);
    } else if (activeIndex < 0 || activeIndex >= options.length) {
      const selectedIndex = options.findIndex((option) => isOptionSelected(option));
      setActiveIndex(Math.max(selectedIndex, 0));
    }
  }

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const handleArrowKey = useCallback(
    (delta: 1 | -1) => {
      const optionCount = options.length;
      if (optionCount === 0) return;
      if (!open) {
        openDropdown();
        return;
      }
      setActiveIndex((current) => wrapActiveIndex(current, optionCount, delta));
    },
    [options.length, open, openDropdown]
  );

  const handleConfirmKey = useCallback(() => {
    const optionCount = options.length;
    if (!open) {
      openDropdown();
      return;
    }
    if (activeIndex < 0 || activeIndex >= optionCount) return;
    selectOption(options[activeIndex]);
  }, [activeIndex, options, open, openDropdown, selectOption]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      const optionCount = options.length;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeDropdown();
          return;
        case 'ArrowDown':
          event.preventDefault();
          handleArrowKey(1);
          return;
        case 'ArrowUp':
          event.preventDefault();
          handleArrowKey(-1);
          return;
        case 'Home':
          if (!open || optionCount === 0) return;
          event.preventDefault();
          setActiveIndex(0);
          return;
        case 'End':
          if (!open || optionCount === 0) return;
          event.preventDefault();
          setActiveIndex(optionCount - 1);
          return;
        case ' ':
          // In a searchable dropdown the same handler is bound to the query input,
          // where Space has to type rather than select.
          if (spaceSkipsInput && (event.target as HTMLElement)?.tagName === 'INPUT') return;
          event.preventDefault();
          handleConfirmKey();
          return;
        case 'Enter':
          event.preventDefault();
          handleConfirmKey();
          return;
        default:
      }
    },
    [
      closeDropdown,
      disabled,
      options.length,
      handleArrowKey,
      handleConfirmKey,
      open,
      spaceSkipsInput,
    ]
  );

  return {
    activeIndex,
    setActiveIndex,
    activeOptionId,
    handleKeyDown,
  };
}

type UseDropdownKeyboardNavArgs = {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  filteredList: DropdownOption[];
  value: string;
  listboxId: string;
  selectOption: (option: DropdownOption) => void;
};

/**
 * setOpen-flavoured adapter over useListboxKeyboardNav for the searchable
 * Dropdown, which identifies options by their `value` field and must let
 * Space type into the query input.
 */
export function useDropdownKeyboardNav({
  open,
  setOpen,
  disabled,
  filteredList,
  value,
  listboxId,
  selectOption,
}: UseDropdownKeyboardNavArgs) {
  const openDropdown = useCallback(() => setOpen(true), [setOpen]);
  const closeDropdown = useCallback(() => setOpen(false), [setOpen]);
  return useListboxKeyboardNav({
    open,
    openDropdown,
    closeDropdown,
    disabled,
    options: filteredList,
    listboxId,
    selectionKey: value,
    getOptionValue: (option) => option.value,
    isOptionSelected: (option) => option.value === value,
    selectOption,
    spaceSkipsInput: true,
  });
}
