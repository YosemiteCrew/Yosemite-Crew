import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InfoSection from '@/app/features/inventory/components/InfoSection';
import { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { BusinessType } from '@/app/features/organization/types/org';

// --- Mocks ---

// Captures the latest props handed to the accordion so tests can invoke
// callback props (fieldFilter / optionsResolver) directly.
let mockAccordionProps: any = null;

// Mock EditableAccordion to inspect props passed to it
jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: function MockEditableAccordion(props: any) {
    mockAccordionProps = props;
    const { title, fields, data, onSave, onEditingChange, ref, readOnly, footer, dynamicFooter } =
      props;
    const [values, setValues] = React.useState(data);
    const setFieldValue = (key: string, value: unknown) => {
      setValues((prev: Record<string, unknown>) => ({ ...prev, [key]: value }));
    };
    return (
      <div data-testid="mock-accordion">
        <div data-testid="acc-title">{title}</div>
        <div data-testid="acc-readonly">{readOnly ? 'true' : 'false'}</div>
        <div data-testid="acc-fields">{JSON.stringify(fields)}</div>
        <div data-testid="acc-data">{JSON.stringify(data)}</div>
        <button
          data-testid="trigger-save"
          onClick={() =>
            onSave(
              values.imageUrl
                ? { someField: 'newValue', imageUrl: values.imageUrl }
                : { someField: 'newValue' }
            )
          }
        >
          Save
        </button>
        <button data-testid="trigger-edit-change" onClick={() => onEditingChange?.(true)}>
          EditChange
        </button>
        <button
          data-testid="trigger-register"
          onClick={() => {
            if (typeof ref === 'function') ref({ save: async () => {} } as any);
            else if (ref) ref.current = { save: async () => {} } as any;
          }}
        >
          Register
        </button>
        {typeof footer === 'function' ? footer({ values, setFieldValue, isEditing: true }) : footer}
        {typeof dynamicFooter === 'function' ? dynamicFooter(values) : null}
      </div>
    );
  },
}));

jest.mock('@/app/features/inventory/components/AddInventory/ImageUploadField', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <button
      type="button"
      data-testid="mock-image-upload"
      data-value={value}
      onClick={() => onChange('inventory/org-1/new-item.png')}
    >
      Upload image
    </button>
  ),
}));

// Mock InventoryConfig to control the shape of the form being tested
jest.mock('@/app/features/inventory/components/AddInventory/InventoryConfig', () => ({
  InventoryFormConfig: {
    vet: {
      basicInfo: [
        {
          kind: 'field',
          field: { name: 'name', component: 'input', placeholder: 'Item Name' },
        },
        {
          kind: 'row',
          fields: [
            {
              name: 'category',
              component: 'dropdown',
              options: ['A', 'B'],
              label: 'Category Label',
            },
            { name: 'expiry', component: 'date', placeholder: 'Expiry Date' },
          ],
        },
        {
          kind: 'field',
          field: {
            name: 'species',
            component: 'multiSelect',
            options: ['Dog', 'Cat'],
            placeholder: 'Species',
          },
        },
        {
          kind: 'field',
          field: {
            name: 'prescriptionRequired',
            component: 'checkbox',
            placeholder: 'Prescription required',
          },
        },
        {
          kind: 'field',
          field: {
            name: 'imageUrl',
            component: 'upload',
            placeholder: 'Product image',
          },
        },
      ],
      emptySection: [], // To test empty state
      classification: [
        {
          kind: 'field',
          field: {
            name: 'itemType',
            component: 'dropdown',
            options: ['drug', 'non-drug'],
            placeholder: 'Item Type',
          },
        },
        {
          kind: 'field',
          field: { name: 'genericName', component: 'text', placeholder: 'Generic Name' },
        },
        {
          kind: 'field',
          field: { name: 'abcClass', component: 'text', placeholder: 'ABC Class', readonly: true },
        },
        {
          kind: 'field',
          field: { name: 'strength', component: 'text', placeholder: 'Strength', numeric: true },
        },
        {
          kind: 'field',
          // No placeholder on purpose so the upload footer falls back to the label.
          field: { name: 'msds', component: 'upload', label: 'MSDS Document' },
        },
      ],
      stock: [
        {
          kind: 'field',
          field: { name: 'allocated', component: 'text', placeholder: 'Allocated stock' },
        },
        {
          kind: 'row',
          fields: [
            { name: 'current', component: 'text', placeholder: 'On hand stock', readonly: true },
            {
              name: 'available',
              component: 'text',
              placeholder: 'Available stock',
              readonly: true,
            },
          ],
        },
        {
          kind: 'field',
          field: {
            name: 'stockLocation',
            component: 'dropdown',
            options: ['DEFAULT-A', 'DEFAULT-B'],
            placeholder: 'Stock Location',
          },
        },
        {
          kind: 'field',
          field: { name: 'withdrawlPeriod', component: 'text', placeholder: 'Withdrawal Period' },
        },
      ],
    },
  },
}));

// --- Test Data ---

const mockInventory: InventoryItem = {
  id: '123',
  basicInfo: {
    name: 'Test Item',
    category: 'A',
    expiry: '2025-01-01',
  },
  stock: {
    current: '100',
    allocated: '20',
    available: '80',
  },
} as any;

describe('InfoSection Component', () => {
  const mockOnSaveSection = jest.fn();
  const mockOnEditingChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it('renders the section title and accordion when config exists', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Information"
        inventory={mockInventory}
      />
    );

    // FIX: "Basic Information" appears in main header div AND mocked accordion title.
    // Check for multiple instances or specific testID.
    const titles = screen.getAllByText('Basic Information');
    expect(titles.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByTestId('mock-accordion')).toBeInTheDocument();

    // Verify title passed to accordion specifically
    expect(screen.getByTestId('acc-title')).toHaveTextContent('Basic Information');
  });

  it("renders 'No fields configured' when configuration is empty", () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey={'emptySection' as any}
        sectionTitle="Empty Section"
        inventory={mockInventory}
      />
    );

    expect(screen.getByText('No fields configured for this section.')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-accordion')).not.toBeInTheDocument();
  });

  it("renders 'No fields configured' when business type or section does not exist", () => {
    render(
      <InfoSection
        businessType={'retail' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Missing Config"
        inventory={mockInventory}
      />
    );

    expect(screen.getByText('No fields configured for this section.')).toBeInTheDocument();
  });

  // --- 2. Logic (Field Mapping & Flattening) ---

  it('correctly maps and flattens configuration fields into EditableFields', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
      />
    );

    const fieldsJson = screen.getByTestId('acc-fields').textContent;
    const fields = JSON.parse(fieldsJson || '[]');

    expect(fields).toHaveLength(5);

    // 1. Text Input Mapping
    expect(fields[0]).toEqual({
      label: 'Item Name',
      key: 'name',
      type: 'text',
    });

    // 2. Dropdown Mapping
    expect(fields[1]).toEqual({
      label: 'Category Label',
      key: 'category',
      type: 'select',
      options: ['A', 'B'],
    });

    // 3. Date Mapping
    expect(fields[2]).toEqual({
      label: 'Expiry Date',
      key: 'expiry',
      type: 'date',
    });

    expect(fields[3]).toEqual({
      label: 'Species',
      key: 'species',
      type: 'multiSelect',
      options: ['Dog', 'Cat'],
    });

    expect(fields[4]).toEqual({
      label: 'Prescription required',
      key: 'prescriptionRequired',
      type: 'checkbox',
    });
  });

  it('passes the correct data subset to the accordion', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
      />
    );

    const dataJson = screen.getByTestId('acc-data').textContent;
    const data = JSON.parse(dataJson || '{}');

    expect(data).toEqual(mockInventory.basicInfo);
  });

  // --- 3. Interaction (Callbacks) ---

  it('calls onSaveSection with the correct section key when accordion saves', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onSaveSection={mockOnSaveSection}
      />
    );

    fireEvent.click(screen.getByTestId('trigger-save'));

    expect(mockOnSaveSection).toHaveBeenCalledWith('basicInfo', {
      someField: 'newValue',
    });
  });

  it('keeps uploaded image changes in the accordion draft until the section saves', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onSaveSection={mockOnSaveSection}
        organisationId="org-1"
      />
    );

    fireEvent.click(screen.getByTestId('mock-image-upload'));
    expect(mockOnSaveSection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('trigger-save'));

    expect(mockOnSaveSection).toHaveBeenCalledWith('basicInfo', {
      someField: 'newValue',
      imageUrl: 'inventory/org-1/new-item.png',
    });
  });

  it('propagates onEditingChange callback', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        onEditingChange={mockOnEditingChange}
      />
    );

    fireEvent.click(screen.getByTestId('trigger-edit-change'));

    expect(mockOnEditingChange).toHaveBeenCalledWith(true);
  });

  it('forwards the actions ref to the accordion', () => {
    const actionsRef = React.createRef<{ save: () => Promise<void> } | null>();
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        ref={actionsRef as any}
      />
    );

    fireEvent.click(screen.getByTestId('trigger-register'));

    expect(actionsRef.current).toEqual(
      expect.objectContaining({
        save: expect.any(Function),
      })
    );
  });

  // --- 4. Props & Edge Cases ---

  it('passes disableEditing prop to accordion as readOnly', () => {
    const { rerender } = render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        disableEditing={true}
      />
    );

    expect(screen.getByTestId('acc-readonly')).toHaveTextContent('true');

    rerender(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
        disableEditing={false}
      />
    );

    expect(screen.getByTestId('acc-readonly')).toHaveTextContent('false');
  });

  it('renders on-hand and available stock as read-only badges in the stock section', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock Control"
        inventory={mockInventory}
      />
    );

    // 'current' and 'available' are readonly and excluded from the editable field list
    const fieldsJson = screen.getByTestId('acc-fields').textContent;
    const fields = JSON.parse(fieldsJson || '[]');
    expect(fields.map((field: any) => field.key)).toEqual([
      'allocated',
      'stockLocation',
      'withdrawlPeriod',
    ]);
    // No stockLocationOptions supplied -> falls back to the field's own options.
    const location = fields.find((field: any) => field.key === 'stockLocation');
    expect(location.options).toEqual(['DEFAULT-A', 'DEFAULT-B']);

    expect(screen.getByText('On hand stock :')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Available stock (dispensable) :')).toBeInTheDocument();
    // available = current(100) - allocated(20) computed live from the footer's formValues
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  // --- 5. Classification section (drug/non-drug logic) ---

  const classificationInventory: InventoryItem = {
    ...mockInventory,
    classification: { itemType: 'drug' },
  } as any;

  it('renders the classification section, mapping readonly and numeric fields', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="classification"
        sectionTitle="Classification"
        inventory={classificationInventory}
      />
    );

    const fields = JSON.parse(screen.getByTestId('acc-fields').textContent || '[]');
    // classification keeps every configured (non-upload) field regardless of item type.
    expect(fields.map((field: any) => field.key)).toEqual([
      'itemType',
      'genericName',
      'abcClass',
      'strength',
    ]);

    const abcClass = fields.find((field: any) => field.key === 'abcClass');
    expect(abcClass.editable).toBe(false);

    const strength = fields.find((field: any) => field.key === 'strength');
    expect(strength.numeric).toBe(true);

    // Upload field with no placeholder renders through the footer using its label.
    expect(screen.getByTestId('mock-image-upload')).toBeInTheDocument();
  });

  it('applies the classification field filter from the itemType form value', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="classification"
        sectionTitle="Classification"
        inventory={classificationInventory}
      />
    );

    const filter = mockAccordionProps.fieldFilter as (
      key: string,
      values: Record<string, any>
    ) => boolean;
    expect(filter).toBeInstanceOf(Function);

    // Drug item type -> everything is kept.
    expect(filter('genericName', { itemType: 'drug' })).toBe(true);
    // Non-drug -> drug-only keys are removed.
    expect(filter('genericName', { itemType: 'non-drug' })).toBe(false);
    // Non-drug -> non-drug keys remain.
    expect(filter('itemType', { itemType: 'non-drug' })).toBe(true);
    // Missing itemType -> treated as not non-drug -> keep.
    expect(filter('genericName', {})).toBe(true);

    // Non-basicInfo sections do not resolve dynamic options.
    expect(mockAccordionProps.optionsResolver).toBeUndefined();
  });

  it('filters drug-only stock fields using the inventory item type', () => {
    const drugStock = {
      ...mockInventory,
      classification: { itemType: 'drug' },
    } as unknown as InventoryItem;

    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock"
        inventory={drugStock}
      />
    );

    const filter = mockAccordionProps.fieldFilter as (
      key: string,
      values: Record<string, any>
    ) => boolean;
    // Drug inventory -> drug-only stock field is kept.
    expect(filter('withdrawlPeriod', {})).toBe(true);
    expect(filter('allocated', {})).toBe(true);
  });

  it('excludes drug-only fields from a non-drug stock section', () => {
    const nonDrugStock = {
      ...mockInventory,
      classification: { itemType: 'Non-Drug' },
    } as unknown as InventoryItem;

    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock"
        inventory={nonDrugStock}
      />
    );

    const fields = JSON.parse(screen.getByTestId('acc-fields').textContent || '[]');
    // 'withdrawlPeriod' is drug-only for the stock section and is dropped for non-drug items.
    expect(fields.map((field: any) => field.key)).toEqual(['allocated', 'stockLocation']);

    // The runtime filter also removes drug-only keys for the non-drug inventory item.
    const filter = mockAccordionProps.fieldFilter as (
      key: string,
      values: Record<string, any>
    ) => boolean;
    expect(filter('withdrawlPeriod', {})).toBe(false);
    expect(filter('allocated', {})).toBe(true);
  });

  it('prefers stockLocationOptions for the stockLocation dropdown when provided', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock"
        inventory={mockInventory}
        stockLocationOptions={['Shelf 1', 'Shelf 2']}
      />
    );

    const fields = JSON.parse(screen.getByTestId('acc-fields').textContent || '[]');
    const location = fields.find((field: any) => field.key === 'stockLocation');
    expect(location.options).toEqual(['Shelf 1', 'Shelf 2']);
  });

  it('ignores an empty stockLocationOptions array and keeps the field options', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock"
        inventory={mockInventory}
        stockLocationOptions={[]}
      />
    );

    const fields = JSON.parse(screen.getByTestId('acc-fields').textContent || '[]');
    const location = fields.find((field: any) => field.key === 'stockLocation');
    expect(location.options).toEqual(['DEFAULT-A', 'DEFAULT-B']);
  });

  it('resolves subcategory options only for the basicInfo subCategory field', () => {
    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="basicInfo"
        sectionTitle="Basic Info"
        inventory={mockInventory}
      />
    );

    const resolver = mockAccordionProps.optionsResolver as (
      key: string,
      values: Record<string, any>
    ) => string[] | undefined;
    expect(resolver).toBeInstanceOf(Function);

    // Any key other than subCategory resolves to undefined.
    expect(resolver('category', {})).toBeUndefined();

    // subCategory resolves to a list derived from the current category value.
    const result = resolver('subCategory', { category: '' });
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBeGreaterThan(0);
  });

  it('computes stock footer values with fallbacks when stock data is missing', () => {
    const emptyStock = { ...mockInventory, stock: {} } as unknown as InventoryItem;

    render(
      <InfoSection
        businessType={'vet' as BusinessType}
        sectionKey="stock"
        sectionTitle="Stock"
        inventory={emptyStock}
      />
    );

    expect(screen.getByText('On hand stock :')).toBeInTheDocument();
    // current and allocated both fall back to 0, so on-hand and available both read 0.
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('handles missing label/placeholder fallback in field mapping', async () => {
    // Modify mock for this specific test case to test fallback to field.name
    jest.resetModules();
    jest.doMock('@/app/features/inventory/components/AddInventory/InventoryConfig', () => ({
      InventoryFormConfig: {
        vet: {
          fallbackTest: [
            {
              kind: 'field',
              field: { name: 'fallbackField', component: 'input' },
            },
          ],
        },
      },
    }));

    // Re-import component to use new mock using dynamic import instead of require
    const { default: ReImportedInfoSection } =
      await import('@/app/features/inventory/components/InfoSection');

    render(
      <ReImportedInfoSection
        businessType={'vet' as BusinessType}
        // FIX: Cast string to 'any' to bypass strict type checking for the test mock key
        sectionKey={'fallbackTest' as any}
        sectionTitle="Fallback Test"
        inventory={mockInventory}
      />
    );

    const fieldsJson = screen.getByTestId('acc-fields').textContent;
    const fields = JSON.parse(fieldsJson || '[]');

    expect(fields[0].label).toBe('fallbackField');
  });
});
