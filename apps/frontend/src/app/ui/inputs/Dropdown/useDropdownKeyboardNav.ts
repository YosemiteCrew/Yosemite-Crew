import { useCallback, useEffect, useState } from 'react';
import { wrapActiveIndex } from './dropdownHelpers';

type DropdownOption = { key: string | number; label: string; value: string };

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
 * Extracted from Dropdown: owns the active-option index, keeps it in sync
 * with the filtered option list / open state / selected value (adjusted
 * during render, per React's "you might not need an effect" guidance — kept
 * as-is, not converted to a reducer), and the roving keyboard navigation
 * (arrow keys, Home/End, Enter/Space, Escape). Pure structural extraction,
 * behavior unchanged.
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
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeOptionId =
    activeIndex >= 0 && activeIndex < filteredList.length
      ? `${listboxId}-option-${filteredList[activeIndex].value}`
      : undefined;

  const [activeIndexDeps, setActiveIndexDeps] = useState({ filteredList, open, value });
  if (
    filteredList !== activeIndexDeps.filteredList ||
    open !== activeIndexDeps.open ||
    value !== activeIndexDeps.value
  ) {
    setActiveIndexDeps({ filteredList, open, value });
    if (!open || filteredList.length === 0) {
      setActiveIndex(-1);
    } else if (activeIndex < 0 || activeIndex >= filteredList.length) {
      const selectedIndex = filteredList.findIndex((option) => option.value === value);
      setActiveIndex(Math.max(selectedIndex, 0));
    }
  }

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const handleArrowKey = useCallback(
    (delta: 1 | -1) => {
      const optionCount = filteredList.length;
      if (optionCount === 0) return;
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => wrapActiveIndex(current, optionCount, delta));
    },
    [filteredList.length, open, setOpen]
  );

  const handleConfirmKey = useCallback(() => {
    const optionCount = filteredList.length;
    if (!open) {
      setOpen(true);
      return;
    }
    if (activeIndex < 0 || activeIndex >= optionCount) return;
    selectOption(filteredList[activeIndex]);
  }, [activeIndex, filteredList, open, selectOption, setOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      const optionCount = filteredList.length;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setOpen(false);
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
          if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
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
    [disabled, filteredList.length, handleArrowKey, handleConfirmKey, open, setOpen]
  );

  return {
    activeIndex,
    setActiveIndex,
    activeOptionId,
    handleKeyDown,
  };
}
