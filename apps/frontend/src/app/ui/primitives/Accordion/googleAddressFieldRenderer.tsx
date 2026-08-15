import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';

export type GoogleAddressFieldRendererProps = {
  field: { key: string; label: string };
  value?: string;
  error?: string;
  onChange: (value: string) => void;
  onMultiChange?: (values: Record<string, string>) => void;
};

/**
 * Shared `googleAddress` entry for field-renderer maps (ProfileCard,
 * EditableAccordion): a GoogleSearchDropDown whose address selection also
 * autofills the sibling city/state/postalCode/country fields.
 */
const GoogleAddressFieldRenderer = ({
  field,
  value,
  onChange,
  onMultiChange,
  error,
}: GoogleAddressFieldRendererProps) => (
  <GoogleSearchDropDown
    intype="text"
    inname={field.key}
    value={value ?? ''}
    inlabel={field.label}
    error={error}
    onChange={(e) => onChange(e.target.value)}
    onlyAddress={true}
    onAddressSelect={(address) => {
      onChange(address.addressLine);
      onMultiChange?.({
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        ...(address.country ? { country: address.country } : {}),
      });
    }}
  />
);

export default GoogleAddressFieldRenderer;
