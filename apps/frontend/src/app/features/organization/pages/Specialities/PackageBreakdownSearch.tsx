import { IoIosSearch } from 'react-icons/io';
import { formatMoney } from '@/app/lib/money';
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
}: PackageBreakdownSearchProps) => (
  <div className="relative">
    <div className="flex items-center gap-2 w-full border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-[var(--field-bg)]">
      <input
        type="text"
        placeholder="Search services, inventory, lab tests, packages..."
        value={searchQuery}
        onChange={(e) => onQueryChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
        aria-label="Search catalog items"
      />
      <IoIosSearch
        size={20}
        color="var(--color-neutral-900)"
        aria-hidden="true"
        className="shrink-0"
      />
    </div>
    {filteredSearch.length > 0 && (
      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--screen)] border border-card-border rounded-2xl shadow-lg overflow-hidden">
        {filteredSearch.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem(item)}
            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-card-hover text-[13px] text-text-primary"
          >
            <span>{item.name}</span>
            <span className="text-[12px] text-text-secondary">
              {TYPE_LABELS[item.type] ?? item.type} ·{' '}
              {formatMoney(item.unitPrice, item.currency ?? orgCurrency)}
            </span>
          </button>
        ))}
      </div>
    )}
    {searchQuery.trim() && filteredSearch.length === 0 && !searchLoading && (
      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--screen)] border border-card-border rounded-2xl shadow-lg px-4 py-3 text-[13px] text-text-secondary">
        No items found.
      </div>
    )}
  </div>
);

export default PackageBreakdownSearch;
