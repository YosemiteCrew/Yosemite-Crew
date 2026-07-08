import React from 'react';
import { FiSliders, FiX, FiChevronUp, FiChevronDown, FiCheck } from 'react-icons/fi';
import Modal from '@/app/ui/overlays/Modal';
import {
  AbcClassOptions,
  InventoryFiltersState,
} from '@/app/features/inventory/pages/Inventory/types';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type InventoryFilterModalProps = {
  filterOpen: boolean;
  selectedFilterChips: FilterChip[];
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
  filters: InventoryFiltersState;
  locationFilterOptions: string[];
  toggleListFilter: (
    key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers',
    value: string
  ) => void;
  categoryOptions: string[];
  categorySubcategoryOptions: Record<string, string[]>;
  expandedCategories: Set<string>;
  toggleCategoryFilter: (category: string) => void;
  toggleExpandedCategory: (category: string) => void;
  supplierFilterOptions: string[];
};

export const InventoryFilterModal = ({
  filterOpen,
  selectedFilterChips,
  setFilterOpen,
  setFilters,
  filterOpenSections,
  toggleFilterSection,
  filters,
  locationFilterOptions,
  toggleListFilter,
  categoryOptions,
  categorySubcategoryOptions,
  expandedCategories,
  toggleCategoryFilter,
  toggleExpandedCategory,
  supplierFilterOptions,
}: InventoryFilterModalProps) => {
  const selectedLocations = new Set(filters.locations);
  const selectedCategories = new Set(filters.categories);
  const selectedSubCategories = new Set(filters.subCategories);
  const selectedAbcClasses = new Set(filters.abcClasses);
  const selectedSuppliers = new Set(filters.suppliers);

  return (
    <Modal showModal={filterOpen} setShowModal={setFilterOpen}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-2 text-body-3-emphasis text-text-primary">
            <FiSliders size={18} aria-hidden="true" />
            <span>Filter</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedFilterChips.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters(defaultFilters)}
                className="rounded-full border border-blue-text px-4 py-1.5 text-body-4 text-blue-text hover:bg-blue-light transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-card-hover transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        {selectedFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 shrink-0">
            {selectedFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-badge-blue-bg py-1 pl-3 pr-2 text-caption-1 capitalize text-badge-blue-text"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label}`}
                  onClick={chip.onRemove}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-badge-blue-text/15 transition-colors"
                >
                  <FiX size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-y-auto pr-1 divide-y divide-card-border">
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('stock-status')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Stock status</span>
                {filters.status !== 'ALL' && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </div>
              {filterOpenSections.has('stock-status') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('stock-status') && (
              <div className="flex flex-col gap-3 pb-3">
                {(['ALL', 'LOW_STOCK', 'EXPIRED', 'OUT_OF_STOCK'] as const).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="stock-status"
                      checked={filters.status === s}
                      onChange={() => setFilters((prev) => ({ ...prev, status: s }))}
                      className="accent-blue-text"
                    />
                    <span>{s === 'ALL' ? 'All' : s.replaceAll('_', ' ').toLowerCase()}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {locationFilterOptions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleFilterSection('location')}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-body-4 text-text-primary">Location</span>
                  {filters.locations.length > 0 && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                      {filters.locations.length}
                    </span>
                  )}
                </div>
                {filterOpenSections.has('location') ? (
                  <FiChevronUp size={16} className="text-text-secondary" />
                ) : (
                  <FiChevronDown size={16} className="text-text-secondary" />
                )}
              </button>
              {filterOpenSections.has('location') && (
                <div className="flex flex-col gap-3 pb-3">
                  {locationFilterOptions.map((loc) => (
                    <label
                      key={loc}
                      className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocations.has(loc)}
                        onChange={() => toggleListFilter('locations', loc)}
                        className="size-4 accent-blue-text"
                      />
                      <span>{loc}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('category')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">Category</span>
                {filters.categories.length > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    {filters.categories.length}
                  </span>
                )}
              </div>
              {filterOpenSections.has('category') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('category') && (
              <div className="flex flex-col pb-3">
                {categoryOptions.map((category) => {
                  const subs = categorySubcategoryOptions[category] ?? [];
                  const isChecked = selectedCategories.has(category);
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategoryFilter(category)}
                          className="size-4 accent-blue-text"
                          id={`cat-${category}`}
                          aria-label={category}
                        />
                        <label
                          htmlFor={`cat-${category}`}
                          className={`flex-1 text-body-4 cursor-pointer ${isChecked ? 'text-blue-text font-semibold' : 'text-text-primary'}`}
                        >
                          {category}
                        </label>
                        {subs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedCategory(category)}
                            className="text-text-secondary"
                            aria-label={isExpanded ? `Collapse ${category}` : `Expand ${category}`}
                          >
                            {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                      {subs.length > 0 && isExpanded && (
                        <div className="ml-6 flex flex-col gap-2 pb-2">
                          {subs.map((sub) => (
                            <label
                              key={sub}
                              className="flex items-center gap-3 text-body-4 text-text-secondary cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubCategories.has(sub)}
                                onChange={() => toggleListFilter('subCategories', sub)}
                                className="size-4 accent-blue-text"
                                aria-label={sub}
                              />
                              <span>{sub}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => toggleFilterSection('abc')}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-4 text-text-primary">ABC</span>
                {filters.abcClasses.length > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                    {filters.abcClasses.length}
                  </span>
                )}
              </div>
              {filterOpenSections.has('abc') ? (
                <FiChevronUp size={16} className="text-text-secondary" />
              ) : (
                <FiChevronDown size={16} className="text-text-secondary" />
              )}
            </button>
            {filterOpenSections.has('abc') && (
              <div className="flex flex-col gap-3 pb-3">
                {AbcClassOptions.map((cls) => (
                  <label
                    key={cls}
                    className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAbcClasses.has(cls)}
                      onChange={() => toggleListFilter('abcClasses', cls)}
                      className="size-4 accent-blue-text"
                    />
                    <span>{cls}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {supplierFilterOptions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleFilterSection('supplier')}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-body-4 text-text-primary">Supplier</span>
                  {filters.suppliers.length > 0 && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
                      {filters.suppliers.length}
                    </span>
                  )}
                </div>
                {filterOpenSections.has('supplier') ? (
                  <FiChevronUp size={16} className="text-text-secondary" />
                ) : (
                  <FiChevronDown size={16} className="text-text-secondary" />
                )}
              </button>
              {filterOpenSections.has('supplier') && (
                <div className="flex flex-col gap-3 pb-3">
                  {supplierFilterOptions.map((sup) => (
                    <label
                      key={sup}
                      className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.has(sup)}
                        onChange={() => toggleListFilter('suppliers', sup)}
                        className="size-4 accent-blue-text"
                      />
                      <span>{sup}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-5 mt-5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-text-primary px-4 text-body-3-emphasis text-white hover:opacity-90 transition-opacity"
          >
            <FiCheck size={18} aria-hidden="true" />
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultFilters);
              setFilterOpen(false);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-card-border bg-white px-4 text-body-3-emphasis text-text-primary hover:bg-card-hover transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InventoryFilterModal;
