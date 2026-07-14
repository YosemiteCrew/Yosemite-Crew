import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import PackageBreakdownSearch from './PackageBreakdownSearch';
import { CatalogEntry, FormErrors } from './packageFormDraftHelpers';

type PackageBreakdownSectionProps = {
  breakdown: PackageBreakdownItem[];
  additionalDiscount: string;
  errors: FormErrors;
  filteredSearch: CatalogEntry[];
  orgCurrency: string;
  searchLoading: boolean;
  searchQuery: string;
  onAdditionalDiscountChange: (value: string) => void;
  onChangeDiscount: (id: string, discount: number) => void;
  onChangeQty: (id: string, qty: number) => void;
  onQueryChange: (value: string) => void;
  onRemoveItem: (id: string) => void;
  onSelectItem: (catalog: CatalogEntry) => void;
};

const PackageBreakdownSection = ({
  breakdown,
  additionalDiscount,
  errors,
  filteredSearch,
  orgCurrency,
  searchLoading,
  searchQuery,
  onAdditionalDiscountChange,
  onChangeDiscount,
  onChangeQty,
  onQueryChange,
  onRemoveItem,
  onSelectItem,
}: PackageBreakdownSectionProps) => (
  <SectionContainer title="Breakdown" nested titleColor="var(--color-neutral-900)">
    <div className="flex flex-col gap-4">
      <PackageBreakdownSearch
        searchQuery={searchQuery}
        onQueryChange={onQueryChange}
        filteredSearch={filteredSearch}
        searchLoading={searchLoading}
        orgCurrency={orgCurrency}
        onSelectItem={onSelectItem}
      />

      {breakdown.length > 0 ? (
        <PackageBreakdownTable
          items={breakdown}
          additionalDiscount={Number.parseFloat(additionalDiscount) || 0}
          editable
          onRemoveItem={onRemoveItem}
          onChangeQty={onChangeQty}
          onChangeDiscount={onChangeDiscount}
        />
      ) : (
        <p className="text-body-4 text-text-secondary text-center py-4">
          Search above to add items to the package breakdown.
        </p>
      )}
      {errors.breakdown && (
        <p className="text-caption-1 text-text-error text-center">{errors.breakdown}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-caption-1 text-text-secondary">Additional Discount (%)</span>
        <div className="w-32">
          <FormInput
            intype="number"
            inlabel="Discount %"
            value={additionalDiscount}
            onChange={(event) => onAdditionalDiscountChange(event.target.value)}
            error={errors.additionalDiscount}
          />
        </div>
      </div>
    </div>
  </SectionContainer>
);

export default PackageBreakdownSection;
