import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FormSection from '@/app/features/inventory/components/AddInventory/FormSection';
import { BusinessType } from '@/app/features/organization/types/org';

// --- Mocks ---
jest.mock('@/app/ui/primitives/Accordion/Accordion', () => {
  return function MockAccordion({ children, title }: any) {
    return (
      <div data-testid="accordion">
        <h3>{title}</h3>
        {children}
      </div>
    );
  };
});

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="btn-primary">
      {text}
    </button>
  ),
  Secondary: ({ onClick, text, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="btn-secondary">
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => (props: any) => (
  <input
    data-testid={`input-${props.inname}`}
    value={props.value}
    onChange={props.onChange}
    placeholder={props.inlabel}
  />
));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => (props: any) => (
  <select
    data-testid={`dropdown-${props.placeholder}`}
    value={props.defaultOption}
    onChange={(e) => props.onSelect({ value: e.target.value, label: e.target.value })}
  >
    <option value="">Select</option>
    {props.options.map((o: any) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => (props: any) => (
  <div data-testid={`multiselect-${props.placeholder}`}>
    <span data-testid="ms-value">{JSON.stringify(props.value)}</span>
    <button onClick={() => props.onChange(['selected_val'])} data-testid="ms-change-btn">
      Change
    </button>
  </div>
));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => (props: any) => (
  <textarea
    data-testid={`textarea-${props.inname}`}
    value={props.value}
    onChange={props.onChange}
  />
));

jest.mock('@/app/ui/inputs/Datepicker', () => {
  return function MockDatepicker({ currentDate, setCurrentDate, placeholder }: any) {
    return (
      <div data-testid={`datepicker-${placeholder}`}>
        <span data-testid="date-value">{currentDate ? currentDate.toISOString() : 'null'}</span>
        <button
          onClick={() => {
            const d = new Date('2023-01-01');
            setCurrentDate(d);
          }}
          data-testid="date-set-direct"
        >
          Set Direct
        </button>
        <button
          onClick={() => {
            setCurrentDate(() => new Date('2023-02-02'));
          }}
          data-testid="date-set-fn"
        >
          Set Function
        </button>
        <button
          onClick={() => {
            setCurrentDate(null);
          }}
          data-testid="date-set-null"
        >
          Set Null
        </button>
      </div>
    );
  };
});

jest.mock(
  '@/app/features/inventory/components/AddInventory/ImageUploadField',
  () => (props: any) => (
    <button data-testid="upload-field" onClick={() => props.onChange('http://img/new.png')}>
      {props.label}
    </button>
  )
);

jest.mock('@/app/features/inventory/components/AddInventory/InventoryConfig', () => ({
  InventoryFormConfig: {
    clinic: {
      basicInfo: [
        {
          kind: 'item',
          field: {
            name: 'itemName',
            component: 'text',
            placeholder: 'Item Name',
          },
        },
        {
          kind: 'row',
          fields: [
            {
              name: 'category',
              component: 'dropdown',
              placeholder: 'Category',
              options: [
                { label: 'A', value: 'a' },
                { label: 'B', value: 'b' },
              ],
            },
            { name: 'description', component: 'textarea', placeholder: 'Desc' },
          ],
        },
        {
          kind: 'item',
          field: { name: 'expiry', component: 'date', placeholder: 'Expiry' },
        },
        {
          kind: 'item',
          field: {
            name: 'tags',
            component: 'multiSelect',
            placeholder: 'Tags',
          },
        },
        { kind: 'item', field: { name: 'unknown', component: 'unknown' } },
      ],
      emptySection: [],
      classification: [
        {
          kind: 'item',
          field: { name: 'genericName', component: 'text', placeholder: 'Generic Name' },
        },
        { kind: 'item', field: { name: 'brand', component: 'text', placeholder: 'Brand' } },
      ],
      batch: [
        {
          kind: 'item',
          field: {
            name: 'batchNumber',
            component: 'text',
            placeholder: 'Batch No',
          },
        },
        { kind: 'item', field: { name: 'tracking', component: 'text', placeholder: 'Tracking' } },
      ],
      stock: [
        {
          kind: 'item',
          field: {
            name: 'stockLocation',
            component: 'dropdown',
            placeholder: 'Stock location / Storage area',
            options: ['Static location'],
          },
        },
        {
          kind: 'row',
          fields: [
            { name: 'current', component: 'text', placeholder: 'On hand stock', readonly: true },
            {
              name: 'available',
              component: 'text',
              placeholder: 'Available stock (dispensable)',
              readonly: true,
            },
          ],
        },
        {
          kind: 'item',
          field: { name: 'withdrawlPeriod', component: 'text', placeholder: 'Withdrawal period' },
        },
      ],
      // Exercises every renderer branch, including placeholder-less fields.
      misc: [
        { kind: 'item', field: { name: 'plainText', component: 'text' } },
        {
          kind: 'item',
          field: { name: 'numericField', component: 'text', placeholder: 'Qty', numeric: true },
        },
        { kind: 'item', field: { name: 'plainDate', component: 'date' } },
        { kind: 'item', field: { name: 'plainDrop', component: 'dropdown' } },
        {
          kind: 'item',
          field: { name: 'subCategory', component: 'dropdown', placeholder: 'Sub Category' },
        },
        { kind: 'item', field: { name: 'plainMulti', component: 'multiSelect' } },
        { kind: 'item', field: { name: 'plainArea', component: 'textarea' } },
        { kind: 'item', field: { name: 'agree', component: 'checkbox', placeholder: 'I agree' } },
        { kind: 'item', field: { name: 'photo', component: 'upload', placeholder: 'Photo' } },
      ],
    },
  },
}));

describe('FormSection Component', () => {
  const mockOnFieldChange = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnClear = jest.fn();
  const mockOnAddBatch = jest.fn();
  const mockOnRemoveBatch = jest.fn();

  const defaultProps = {
    businessType: 'clinic' as BusinessType,
    sectionKey: 'basicInfo' as any,
    sectionTitle: 'Basic Information',
    formData: {
      basicInfo: {
        itemName: 'Test Item',
        category: 'a',
        description: 'Test Desc',
        expiry: '2023-12-31',
        tags: ['tag1'],
      },
      batches: [],
    } as any,
    errors: { basicInfo: { itemName: 'Name required' } } as any,
    onFieldChange: mockOnFieldChange,
    onSave: mockOnSave,
    onClear: mockOnClear,
    onAddBatch: mockOnAddBatch,
    onRemoveBatch: mockOnRemoveBatch,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'No fields configured' if config is missing or empty", () => {
    render(<FormSection {...defaultProps} sectionKey={'emptySection' as any} />);
    expect(screen.getByText('No fields configured.')).toBeInTheDocument();
  });

  it('renders standard fields correctly (Text, Dropdown, Textarea, Row Layout)', () => {
    render(<FormSection {...defaultProps} />);

    // To handle multiple elements with same text (title inside Accordion + Header), we use getAllByText
    const titles = screen.getAllByText('Basic Information');
    expect(titles.length).toBeGreaterThan(0);

    // Text Input
    const input = screen.getByTestId('input-itemName');
    expect(input).toHaveValue('Test Item');

    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      'basicInfo',
      'itemName',
      'New Name',
      undefined
    );

    // Dropdown (inside Row)
    const dropdown = screen.getByTestId('dropdown-Category');
    expect(dropdown).toHaveValue('a');

    fireEvent.change(dropdown, { target: { value: 'b' } });
    expect(mockOnFieldChange).toHaveBeenLastCalledWith('basicInfo', 'category', 'b', undefined);

    // Textarea (inside Row)
    const textarea = screen.getByTestId('textarea-description');
    expect(textarea).toHaveValue('Test Desc');
  });

  it('handles Date parsing and changes correctly', () => {
    render(<FormSection {...defaultProps} />);
    const dateValue = screen.getByTestId('date-value');
    expect(dateValue).toHaveTextContent('2023-12-31');

    fireEvent.click(screen.getByTestId('date-set-direct'));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      'basicInfo',
      'expiry',
      '2023-01-01',
      undefined
    );

    fireEvent.click(screen.getByTestId('date-set-fn'));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      'basicInfo',
      'expiry',
      '2023-02-02',
      undefined
    );

    fireEvent.click(screen.getByTestId('date-set-null'));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith('basicInfo', 'expiry', '', undefined);
  });

  it('handles Custom Date Formats (dd/mm/yyyy)', () => {
    const props = {
      ...defaultProps,
      formData: {
        basicInfo: { expiry: '15/05/2025' },
      } as any,
    };
    render(<FormSection {...props} />);
    const dateValue = screen.getByTestId('date-value');
    expect(dateValue).toHaveTextContent('2025-05-15');
  });

  it('handles Invalid Date formats gracefully', () => {
    const props = {
      ...defaultProps,
      formData: {
        basicInfo: { expiry: 'invalid-date-string' },
      } as any,
    };
    render(<FormSection {...props} />);
    const dateValue = screen.getByTestId('date-value');
    expect(dateValue).toHaveTextContent('null');
  });

  it('handles MultiSelect Parsing logic', () => {
    const { rerender } = render(<FormSection {...defaultProps} />);
    expect(screen.getByTestId('ms-value')).toHaveTextContent('["tag1"]');

    const propsString = {
      ...defaultProps,
      formData: { basicInfo: { tags: 'a, b' } } as any,
    };
    rerender(<FormSection {...propsString} />);
    expect(screen.getByTestId('ms-value')).toHaveTextContent('["a","b"]');

    const propsEmpty = {
      ...defaultProps,
      formData: { basicInfo: { tags: null } } as any,
    };
    rerender(<FormSection {...propsEmpty} />);
    expect(screen.getByTestId('ms-value')).toHaveTextContent('[]');

    fireEvent.click(screen.getByTestId('ms-change-btn'));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      'basicInfo',
      'tags',
      ['selected_val'],
      undefined
    );
  });

  it('uses room-driven stock location options when provided', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock details"
        formData={{ stock: { stockLocation: 'Room A' } } as any}
        stockLocationOptions={['Room A', 'Room B']}
      />
    );

    const dropdown = screen.getByTestId('dropdown-Stock location / Storage area');
    expect(dropdown).toHaveValue('Room A');
    expect(screen.getByRole('option', { name: 'Room B' })).toBeInTheDocument();
  });

  it('renders on-hand stock and available stock as read-only badges', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock details"
        formData={{ stock: { current: '100', allocated: '20' } } as any}
      />
    );

    expect(screen.getByText('On hand stock :')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Available stock (dispensable) :')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.queryByTestId('input-current')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-available')).not.toBeInTheDocument();
  });

  it('falls back to zero for object read-only stock values', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock details"
        formData={{ stock: { current: { count: 100 }, allocated: '20' } } as any}
      />
    );

    expect(screen.getByText('On hand stock :')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('renders Batch section with Add/Remove buttons', () => {
    const batchProps = {
      ...defaultProps,
      sectionKey: 'batch' as any,
      formData: {
        batches: [{ batchNumber: 'B1' }, { batchNumber: 'B2' }],
      } as any,
      errors: {
        batch: { batchNumber: 'Batch Error' },
      } as any,
    };

    render(<FormSection {...batchProps} />);

    expect(screen.getByText('Batch 1')).toBeInTheDocument();
    expect(screen.getByText('Batch 2')).toBeInTheDocument();

    const inputs = screen.getAllByTestId('input-batchNumber');
    expect(inputs[0]).toHaveValue('B1');
    expect(inputs[1]).toHaveValue('B2');

    fireEvent.change(inputs[0], { target: { value: 'B1-UPDATED' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('batch', 'batchNumber', 'B1-UPDATED', 0);

    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    expect(mockOnRemoveBatch).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByText('Add another batch'));
    expect(mockOnAddBatch).toHaveBeenCalled();
  });

  it('renders single Batch fallback if formData.batches is empty/undefined', () => {
    const batchProps = {
      ...defaultProps,
      sectionKey: 'batch' as any,
      formData: {
        batches: undefined,
        batch: { batchNumber: 'FallbackBatch' },
      } as any,
    };

    render(<FormSection {...batchProps} />);
    expect(screen.getByText('Batch 1')).toBeInTheDocument();
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('handles Buttons actions and props', () => {
    render(<FormSection {...defaultProps} saveLabel="Custom Save" disableSave={false} />);

    const saveBtn = screen.getByTestId('btn-primary');
    const clearBtn = screen.getByTestId('btn-secondary');

    expect(saveBtn).toHaveTextContent('Custom Save');
    expect(saveBtn).toBeEnabled();

    fireEvent.click(clearBtn);
    expect(mockOnClear).toHaveBeenCalled();

    fireEvent.click(saveBtn);
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('parses non-ISO date strings via the native Date fallback', () => {
    render(
      <FormSection {...defaultProps} formData={{ basicInfo: { expiry: 'Jan 15 2023' } } as any} />
    );
    // Native Date fallback returns a valid date (line 50 non-null branch).
    expect(screen.getByTestId('date-value')).not.toHaveTextContent('null');
  });

  it('hides drug-only classification fields for non-drug items', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'classification' as any}
        sectionTitle="Classification"
        formData={{ classification: { itemType: 'non-drug' } } as any}
        errors={{} as any}
      />
    );
    // Drug-only field is dropped, generic field stays (lines 134-135, 265, 267).
    expect(screen.queryByTestId('input-genericName')).not.toBeInTheDocument();
    expect(screen.getByTestId('input-brand')).toBeInTheDocument();
  });

  it('hides drug-only batch fields for non-drug items', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'batch' as any}
        formData={
          { classification: { itemType: 'non-drug' }, batches: [{ batchNumber: 'B1' }] } as any
        }
        errors={{} as any}
      />
    );
    // Line 136.
    expect(screen.getByTestId('input-batchNumber')).toBeInTheDocument();
    expect(screen.queryByTestId('input-tracking')).not.toBeInTheDocument();
  });

  it('hides drug-only stock fields for non-drug items', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock"
        formData={{ classification: { itemType: 'non-drug' }, stock: { stockLocation: '' } } as any}
        errors={{} as any}
      />
    );
    // Line 137.
    expect(screen.queryByTestId('input-withdrawlPeriod')).not.toBeInTheDocument();
  });

  it('keeps fields for non-drug items in unrelated sections', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'basicInfo' as any}
        formData={{ classification: { itemType: 'non-drug' }, basicInfo: { itemName: 'x' } } as any}
        errors={{} as any}
      />
    );
    // Section not in any drug-only group -> field renders (line 138).
    expect(screen.getByTestId('input-itemName')).toBeInTheDocument();
  });

  it('renders every field component type in a section', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { agree: 'false' } } as any}
        errors={{} as any}
      />
    );
    // Placeholder-less text/date/dropdown/multiselect/textarea + subCategory + checkbox + upload
    // (lines 171-174, 236, 291, 312, 325, 340, 347-371).
    expect(screen.getByTestId('input-plainText')).toBeInTheDocument();
    expect(screen.getByTestId('datepicker-')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-Sub Category')).toBeInTheDocument();
    expect(screen.getByTestId('multiselect-')).toBeInTheDocument();
    expect(screen.getByTestId('textarea-plainArea')).toBeInTheDocument();
    expect(screen.getByText('I agree')).toBeInTheDocument();
    expect(screen.getByTestId('upload-field')).toBeInTheDocument();
  });

  it('strips non-numeric characters from numeric fields', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { numericField: '' } } as any}
        errors={{} as any}
      />
    );
    fireEvent.change(screen.getByTestId('input-numericField'), { target: { value: 'abc12.5' } });
    // Numeric sanitisation (line 239).
    expect(mockOnFieldChange).toHaveBeenLastCalledWith('misc', 'numericField', '12.5', undefined);
  });

  it('toggles checkbox fields and reads truthy string values', () => {
    const { rerender } = render(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { agree: 'true' } } as any}
        errors={{} as any}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked(); // value 'true' -> checked
    fireEvent.click(checkbox);
    expect(mockOnFieldChange).toHaveBeenLastCalledWith('misc', 'agree', 'false', undefined);

    rerender(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { agree: 'false' } } as any}
        errors={{} as any}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mockOnFieldChange).toHaveBeenLastCalledWith('misc', 'agree', 'true', undefined);

    rerender(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { agree: 'Yes' } } as any}
        errors={{} as any}
      />
    );
    // 'Yes' also reads as checked (line 348).
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('forwards uploaded image urls', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { photo: '' } } as any}
        errors={{} as any}
        organisationId="org-1"
      />
    );
    fireEvent.click(screen.getByTestId('upload-field'));
    // Upload component wiring (lines 362-371).
    expect(mockOnFieldChange).toHaveBeenLastCalledWith(
      'misc',
      'photo',
      'http://img/new.png',
      undefined
    );
  });

  it('coerces numeric and empty multiselect values', () => {
    const { rerender } = render(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { plainMulti: 42 } } as any}
        errors={{} as any}
      />
    );
    // Numeric value coerced to a string list (line 179).
    expect(screen.getByTestId('ms-value')).toHaveTextContent('["42"]');

    rerender(
      <FormSection
        {...defaultProps}
        sectionKey={'misc' as any}
        sectionTitle="Misc"
        formData={{ misc: { plainMulti: '' } } as any}
        errors={{} as any}
      />
    );
    // Empty string -> empty list (line 183).
    expect(screen.getByTestId('ms-value')).toHaveTextContent('[]');
  });

  it('shows available stock from the raw value when derived stock is unavailable', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock"
        formData={{ stock: { available: '55' } } as any}
        errors={{} as any}
      />
    );
    // getAvailableStock undefined -> toNumberSafe(value) fallback (line 193).
    expect(screen.getByText('55')).toBeInTheDocument();
  });

  it('falls back to zero when available stock cannot be resolved', () => {
    render(
      <FormSection
        {...defaultProps}
        sectionKey={'stock' as any}
        sectionTitle="Stock"
        formData={{ stock: { available: 'xyz' } } as any}
        errors={{} as any}
      />
    );
    // Both derived and numeric coercion fail -> '0' (line 193 final fallback).
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.queryByText('xyz')).not.toBeInTheDocument();
  });

  it('renders nothing configured for an unknown business type', () => {
    render(<FormSection {...defaultProps} businessType={'unknown' as any} />);
    // InventoryFormConfig[businessType] ?? {} branch (line 395).
    expect(screen.getByText('No fields configured.')).toBeInTheDocument();
  });
});
