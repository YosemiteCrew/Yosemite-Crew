import { useId, useState } from 'react';
import { IoIosSearch } from 'react-icons/io';
import { formatMoney } from '@/app/lib/money';
import { useListboxKeyboardNav } from '@/app/ui/inputs/Dropdown/useDropdownKeyboardNav';
import { CatalogEntry, TYPE_LABELS } from './packageFormDraftHelpers';

type PackageBreakdownSearchProps = {
  searchQuery: string;
  onQueryChange: (value: string) => void;
  filteredSearch: CatalogEntry[];
  searchLoading: boolean;
  orgCurrency: string;
  onSelectItem: (item: CatalogEntry) => void;
};

const PackageBreakdownSearch = ({
  searchQuery,
  onQueryChange,
  filteredSearch,
  searchLoading,
  orgCurrency,
  onSelectItem,
}: PackageBreakdownSearchProps) => {
  const listboxId = useId();

  // Neither panel owns an open flag - visibility derives entirely from the
  // search props above. Escape has nothing to flip, so it hides the panel
  // locally instead; typing again (a new searchQuery) clears the dismissal.
  // Adjusted during render rather than in an effect (React's "you might not
  // need an effect" guidance), matching useDropdownKeyboardNav's own pattern.
  const [dismissed, setDismissed] = useState(false);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setDismissed(false);
  }

  const showResults = !dismissed && filteredSearch.length > 0;
  const showEmpty =
    !dismissed && searchQuery.trim().length > 0 && filteredSearch.length === 0 && !searchLoading;

  const selectItem = (item: CatalogEntry) => {
    onSelectItem(item);
    setDismissed(true);
  };

  const { activeOptionId, setActiveIndex, handleKeyDown } = useListboxKeyboardNav({
    open: showResults,
    openDropdown: () => setDismissed(false),
    closeDropdown: () => setDismissed(true),
    options: filteredSearch,
    listboxId,
    selectionKey: undefined,
    getOptionValue: (option) => option.id,
    isOptionSelected: () => false,
    selectOption: selectItem,
    spaceSkipsInput: true,
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 w-full border border-[var(--hairline)] rounded-[12px] px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-[var(--field-bg)]">
        <input
          type="text"
          placeholder="Search services, inventory, lab tests, packages..."
          value={searchQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
          aria-label="Search catalog items"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
        />
        <IoIosSearch
          size={20}
          color="var(--color-neutral-900)"
          aria-hidden="true"
          className="shrink-0"
        />
      </div>
      {showResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Catalog search results"
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--screen)] border border-[var(--hairline)] rounded-[13px] shadow-[0_24px_60px_var(--sh28)] overflow-hidden"
        >
          {filteredSearch.map((item, index) => {
            const optionId = `${listboxId}-option-${item.id}`;
            const isActive = activeOptionId === optionId;
            return (
              <button
                key={item.id}
                id={optionId}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectItem(item)}
                className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-card-hover text-[13px] text-text-primary ${
                  isActive ? 'bg-card-hover' : ''
                }`}
              >
                <span>{item.name}</span>
                <span className="text-[12px] text-text-secondary">
                  {TYPE_LABELS[item.type] ?? item.type} ·{' '}
                  {formatMoney(item.unitPrice, item.currency ?? orgCurrency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {showEmpty && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--screen)] border border-[var(--hairline)] rounded-[13px] shadow-[0_24px_60px_var(--sh28)] px-4 py-3 text-[13px] text-text-secondary">
          No items found.
        </div>
      )}
    </div>
  );
};

export default PackageBreakdownSearch;
