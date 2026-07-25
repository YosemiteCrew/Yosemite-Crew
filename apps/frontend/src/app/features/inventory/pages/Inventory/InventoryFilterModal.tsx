import React from 'react';
import { FiSliders, FiX, FiChevronUp, FiChevronDown, FiCheck } from 'react-icons/fi';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
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

type FilterSectionHeaderProps = {
  title: string;
  count: number;
  sectionKey: string;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
};

const FilterSectionHeader = ({
  title,
  count,
  sectionKey,
  filterOpenSections,
  toggleFilterSection,
}: FilterSectionHeaderProps) => {
  const isOpen = filterOpenSections.has(sectionKey);

  return (
    <button
      type="button"
      onClick={() => toggleFilterSection(sectionKey)}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-body-4 text-text-primary">{title}</span>
        {count > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-text text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </div>
      {isOpen ? (
        <FiChevronUp size={16} className="text-text-secondary" />
      ) : (
        <FiChevronDown size={16} className="text-text-secondary" />
      )}
    </button>
  );
};

type FilterModalHeaderProps = {
  selectedFilterChips: FilterChip[];
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
};

const FilterModalHeader = ({
  selectedFilterChips,
  setFilterOpen,
  setFilters,
}: FilterModalHeaderProps) => (
  <ModalHeader
    title="Filter"
    icon={<FiSliders size={16} aria-hidden="true" className="text-[var(--ink-faint)]" />}
    onClose={() => setFilterOpen(false)}
    actions={
      selectedFilterChips.length > 0 && (
        <button
          type="button"
          onClick={() => setFilters(defaultFilters)}
          className="rounded-full border border-blue-text px-4 py-1.5 text-caption-1 text-blue-text hover:bg-blue-light transition-colors"
        >
          Clear all
        </button>
      )
    }
  />
);

type SelectedFilterChipsProps = {
  selectedFilterChips: FilterChip[];
};

const SelectedFilterChips = ({ selectedFilterChips }: SelectedFilterChipsProps) => {
  if (selectedFilterChips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 shrink-0">
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
  );
};

type StockStatusSectionProps = {
  filters: InventoryFiltersState;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
};

const StockStatusSection = ({
  filters,
  filterOpenSections,
  toggleFilterSection,
  setFilters,
}: StockStatusSectionProps) => (
  <div>
    <FilterSectionHeader
      title="Stock status"
      count={filters.status === 'ALL' ? 0 : 1}
      sectionKey="stock-status"
      filterOpenSections={filterOpenSections}
      toggleFilterSection={toggleFilterSection}
    />
    {filterOpenSections.has('stock-status') && (
      <div className="flex flex-col gap-3 pb-3">
        {(['ALL', 'LOW_STOCK', 'EXPIRED', 'OUT_OF_STOCK'] as const).map((status) => (
          <label
            key={status}
            className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
          >
            <input
              type="radio"
              name="stock-status"
              checked={filters.status === status}
              onChange={() => setFilters((prev) => ({ ...prev, status }))}
              className="accent-blue-text"
            />
            <span>{status === 'ALL' ? 'All' : status.replaceAll('_', ' ').toLowerCase()}</span>
          </label>
        ))}
      </div>
    )}
  </div>
);

type CheckboxFilterSectionProps = {
  title: string;
  sectionKey: string;
  options: string[];
  selectedValues: Set<string>;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
  onToggle: (value: string) => void;
};

const CheckboxFilterSection = ({
  title,
  sectionKey,
  options,
  selectedValues,
  filterOpenSections,
  toggleFilterSection,
  onToggle,
}: CheckboxFilterSectionProps) => {
  if (options.length === 0) return null;

  return (
    <div>
      <FilterSectionHeader
        title={title}
        count={selectedValues.size}
        sectionKey={sectionKey}
        filterOpenSections={filterOpenSections}
        toggleFilterSection={toggleFilterSection}
      />
      {filterOpenSections.has(sectionKey) && (
        <div className="flex flex-col gap-3 pb-3">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 text-body-4 text-text-primary cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.has(option)}
                onChange={() => onToggle(option)}
                className="size-4 accent-blue-text"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

type CategoryFilterSectionProps = {
  filters: InventoryFiltersState;
  categoryOptions: string[];
  categorySubcategoryOptions: Record<string, string[]>;
  selectedCategories: Set<string>;
  selectedSubCategories: Set<string>;
  expandedCategories: Set<string>;
  filterOpenSections: Set<string>;
  toggleFilterSection: (key: string) => void;
  toggleCategoryFilter: (category: string) => void;
  toggleExpandedCategory: (category: string) => void;
  toggleListFilter: (
    key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers',
    value: string
  ) => void;
};

const CategoryFilterSection = ({
  filters,
  categoryOptions,
  categorySubcategoryOptions,
  selectedCategories,
  selectedSubCategories,
  expandedCategories,
  filterOpenSections,
  toggleFilterSection,
  toggleCategoryFilter,
  toggleExpandedCategory,
  toggleListFilter,
}: CategoryFilterSectionProps) => (
  <div>
    <FilterSectionHeader
      title="Category"
      count={filters.categories.length}
      sectionKey="category"
      filterOpenSections={filterOpenSections}
      toggleFilterSection={toggleFilterSection}
    />
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
);

type FilterModalFooterProps = {
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
};

const FilterModalFooter = ({ setFilterOpen, setFilters }: FilterModalFooterProps) => (
  <ModalFooter align="stretch">
    <Primary
      href="#"
      text="Apply"
      icon={<FiCheck aria-hidden="true" />}
      onClick={() => setFilterOpen(false)}
    />
    <Secondary
      href="#"
      text="Discard"
      onClick={() => {
        setFilters(defaultFilters);
        setFilterOpen(false);
      }}
    />
  </ModalFooter>
);

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
    <Modal showModal={filterOpen} setShowModal={setFilterOpen} size="sm">
      <div className="flex h-full flex-col gap-4">
        <FilterModalHeader
          selectedFilterChips={selectedFilterChips}
          setFilterOpen={setFilterOpen}
          setFilters={setFilters}
        />
        <SelectedFilterChips selectedFilterChips={selectedFilterChips} />
        <div className="flex flex-1 flex-col overflow-y-auto pr-1 divide-y divide-card-border">
          <StockStatusSection
            filters={filters}
            filterOpenSections={filterOpenSections}
            toggleFilterSection={toggleFilterSection}
            setFilters={setFilters}
          />
          <CheckboxFilterSection
            title="Location"
            sectionKey="location"
            options={locationFilterOptions}
            selectedValues={selectedLocations}
            filterOpenSections={filterOpenSections}
            toggleFilterSection={toggleFilterSection}
            onToggle={(location) => toggleListFilter('locations', location)}
          />
          <CategoryFilterSection
            filters={filters}
            categoryOptions={categoryOptions}
            categorySubcategoryOptions={categorySubcategoryOptions}
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            expandedCategories={expandedCategories}
            filterOpenSections={filterOpenSections}
            toggleFilterSection={toggleFilterSection}
            toggleCategoryFilter={toggleCategoryFilter}
            toggleExpandedCategory={toggleExpandedCategory}
            toggleListFilter={toggleListFilter}
          />
          <CheckboxFilterSection
            title="ABC"
            sectionKey="abc"
            options={AbcClassOptions}
            selectedValues={selectedAbcClasses}
            filterOpenSections={filterOpenSections}
            toggleFilterSection={toggleFilterSection}
            onToggle={(abcClass) => toggleListFilter('abcClasses', abcClass)}
          />
          <CheckboxFilterSection
            title="Supplier"
            sectionKey="supplier"
            options={supplierFilterOptions}
            selectedValues={selectedSuppliers}
            filterOpenSections={filterOpenSections}
            toggleFilterSection={toggleFilterSection}
            onToggle={(supplier) => toggleListFilter('suppliers', supplier)}
          />
        </div>
        <FilterModalFooter setFilterOpen={setFilterOpen} setFilters={setFilters} />
      </div>
    </Modal>
  );
};

export default InventoryFilterModal;
