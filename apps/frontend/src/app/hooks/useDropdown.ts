import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
};

type UseDropdownOptions = {
  searchable?: boolean;
  onClose?: () => void;
};

export const useDropdown = (options: UseDropdownOptions = {}) => {
  const { searchable = true, onClose } = options;
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearchQuery("");
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, searchable]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  const openDropdown = useCallback(() => {
    setOpen(true);
  }, []);

  const toggleDropdown = useCallback(() => {
    setOpen((prev) => {
      if (prev) setSearchQuery("");
      return !prev;
    });
  }, []);

  return {
    open,
    setOpen,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    inputRef,
    closeDropdown,
    openDropdown,
    toggleDropdown,
  };
};

export const useFilteredOptions = <T extends DropdownOption>(
  options: T[],
  searchQuery: string,
) => {
  return useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchQuery]);
};
