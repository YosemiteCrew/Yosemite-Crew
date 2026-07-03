import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => {
  return function MockAccordion({
    title,
    children,
    onEditClick,
    showEditIcon,
    showDeleteIcon,
    onDeleteClick,
  }: any) {
    return (
      <div data-testid="accordion">
        <h3>{title}</h3>
        {showEditIcon && (
          <button type="button" onClick={onEditClick}>
            Toggle Edit
          </button>
        )}
        {showDeleteIcon && (
          <button type="button" onClick={onDeleteClick}>
            Delete
          </button>
        )}
        {children}
      </div>
    );
  };
});

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, onAddressSelect }: any) => (
    <label>
      {inlabel}
      <input
        aria-label={inlabel}
        value={value}
        onChange={onChange}
        data-testid={`google-search-${inlabel}`}
      />
      <button
        type="button"
        data-testid={`select-address-${inlabel}`}
        onClick={() =>
          onAddressSelect?.({
            addressLine: '42 Autofill Rd',
            city: 'Autofill City',
            state: 'Autofill State',
            postalCode: '99999',
            country: 'Autofill Country',
          })
        }
      >
        Select address
      </button>
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, defaultOption, onSelect, error }: any) => (
    <label>
      {placeholder}
      <select
        aria-label={placeholder}
        value={defaultOption ?? ''}
        onChange={(e) => {
          const selected = options.find((o: any) => o.value === e.target.value);
          onSelect(selected);
        }}
      >
        <option value="">Select</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value, options, onChange, error }: any) => (
    <label>
      {placeholder}
      <select
        aria-label={placeholder}
        multiple
        value={value}
        onChange={(e) => {
          const next = Array.from((e.target as HTMLSelectElement).selectedOptions).map(
            (opt) => opt.value
          );
          onChange(next);
        }}
      >
        {options.map((opt: any) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ label, value, onChange, error }: any) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ setCurrentDate, placeholder }: any) => (
    <div>
      <button type="button" onClick={() => setCurrentDate(new Date('2024-02-01'))}>
        {placeholder}
      </button>
      <button
        type="button"
        aria-label={`clear-${placeholder}`}
        onClick={() => setCurrentDate(null)}
      >
        Clear {placeholder}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  formatDisplayDate: (val: string) => (val ? 'Feb 1, 2024' : ''),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getFormattedDate: () => 'Feb 1, 2024',
}));

jest.mock('@/app/lib/forms', () => ({
  formatTimeLabel: () => '10:00 AM',
}));

jest.mock('@/app/lib/validators', () => ({
  toTitleCase: () => 'Active',
}));

describe('EditableAccordion Component', () => {
  it('renders field values in view mode', () => {
    render(
      <EditableAccordion
        title="Profile"
        fields={[
          { label: 'Name', key: 'name', type: 'text' },
          { label: 'Status', key: 'status', type: 'status' },
          {
            label: 'Role',
            key: 'role',
            type: 'select',
            options: [{ label: 'Admin', value: 'admin' }],
          },
          {
            label: 'Tags',
            key: 'tags',
            type: 'multiSelect',
            options: ['A', 'B'],
          },
          { label: 'Birth', key: 'dob', type: 'date' },
          { label: 'Time', key: 'time', type: 'time' },
        ]}
        data={{
          name: 'Rex',
          status: 'active',
          role: 'admin',
          tags: ['A', 'B'],
          dob: '2024-02-01',
          time: '10:00',
        }}
        defaultOpen
      />
    );

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('A, B')).toBeInTheDocument();
    expect(screen.getAllByText('Feb 1, 2024').length).toBeGreaterThan(0);
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  it('shows validation errors and blocks save when required fields are empty', async () => {
    const onSave = jest.fn();
    render(
      <EditableAccordion
        title="Required"
        fields={[{ label: 'Name', key: 'name', type: 'text', required: true }]}
        data={{ name: '' }}
        defaultOpen
      />
    );

    fireEvent.click(screen.getByText('Toggle Edit'));
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('saves updated values when valid', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <EditableAccordion
        title="Profile"
        fields={[{ label: 'Name', key: 'name', type: 'text', required: true }]}
        data={{ name: 'Old' }}
        defaultOpen
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByText('Toggle Edit'));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(onSave).toHaveBeenCalledWith({ name: 'New' });
  });

  it('merges footer field changes into the current draft before saving', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <EditableAccordion
        title="Inventory"
        fields={[{ label: 'Name', key: 'name', type: 'text', required: true }]}
        data={{ name: 'Old', imageUrl: '' }}
        defaultOpen
        onSave={onSave}
        footer={({ values, setFieldValue }) => (
          <button
            type="button"
            onClick={() => setFieldValue('imageUrl', 'inventory/org-1/new-item.png')}
          >
            {values.imageUrl || 'Upload image'}
          </button>
        )}
      />
    );

    fireEvent.click(screen.getByText('Toggle Edit'));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New name' },
    });
    fireEvent.click(screen.getByText('Upload image'));

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(onSave).toHaveBeenCalledWith({
      name: 'New name',
      imageUrl: 'inventory/org-1/new-item.png',
    });
  });

  it('renders googleAddress field in edit mode and autofills sibling fields on address select', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <EditableAccordion
        title="Address"
        fields={[
          { label: 'Address line', key: 'addressLine', type: 'googleAddress', editable: true },
          { label: 'City', key: 'city', type: 'text', editable: true },
          { label: 'State / Province', key: 'state', type: 'text', editable: true },
          { label: 'Postal code', key: 'postalCode', type: 'text', editable: true },
        ]}
        data={{ addressLine: '', city: '', state: '', postalCode: '' }}
        defaultOpen
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByText('Toggle Edit'));

    // GoogleSearchDropDown is rendered for addressLine
    expect(screen.getByTestId('google-search-Address line')).toBeInTheDocument();

    // Selecting an address autofills all sibling fields via onMultiChange
    fireEvent.click(screen.getByTestId('select-address-Address line'));

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        addressLine: '42 Autofill Rd',
        city: 'Autofill City',
        state: 'Autofill State',
        postalCode: '99999',
      })
    );
  });

  it('renders googleAddress field value in view mode', () => {
    render(
      <EditableAccordion
        title="Address"
        fields={[{ label: 'Address line', key: 'addressLine', type: 'googleAddress' }]}
        data={{ addressLine: '123 Main St' }}
        defaultOpen
      />
    );

    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('registers and clears external actions', () => {
    const onRegisterActions = jest.fn();
    const { unmount } = render(
      <EditableAccordion
        title="Profile"
        fields={[{ label: 'Name', key: 'name', type: 'text' }]}
        data={{ name: 'Rex' }}
        onRegisterActions={onRegisterActions}
      />
    );

    expect(onRegisterActions).toHaveBeenCalledWith(
      expect.objectContaining({
        save: expect.any(Function),
        cancel: expect.any(Function),
        startEditing: expect.any(Function),
        isEditing: expect.any(Function),
      })
    );

    unmount();
    expect(onRegisterActions).toHaveBeenLastCalledWith(null);
  });

  describe('numeric field guard', () => {
    it('strips non-numeric characters from a numeric text field', () => {
      render(
        <EditableAccordion
          title="Stock"
          fields={[{ label: 'Quantity', key: 'quantity', type: 'text', numeric: true }]}
          data={{ quantity: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: 'ab12.5.6cd' } });

      expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('12.56');
    });

    it('does not strip characters from a non-numeric text field', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex 2nd' } });

      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Rex 2nd');
    });

    it('strips non-numeric characters from a number-type field', () => {
      render(
        <EditableAccordion
          title="Stock"
          fields={[{ label: 'Amount', key: 'amount', type: 'number' }]}
          data={{ amount: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'x9y9.9z' } });

      expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('99.9');
    });

    it('strips non-numeric characters from a currency field regardless of the numeric flag', () => {
      render(
        <EditableAccordion
          title="Pricing"
          fields={[{ label: 'Selling price', key: 'selling', type: 'text' }]}
          data={{ selling: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Selling price'), { target: { value: '$1a2.3b4' } });

      expect((screen.getByLabelText('Selling price') as HTMLInputElement).value).toBe('12.34');
    });
  });

  describe('fieldResets cascade', () => {
    it('clears the dependent field value when the source field changes', () => {
      render(
        <EditableAccordion
          title="Classification"
          fields={[
            {
              label: 'Category',
              key: 'category',
              type: 'select',
              options: ['Medicine', 'Food'],
            },
            { label: 'Subcategory', key: 'subCategory', type: 'text' },
          ]}
          data={{ category: 'Medicine', subCategory: 'Antibiotic' }}
          defaultOpen
          fieldResets={{ category: ['subCategory'] }}
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      expect((screen.getByLabelText('Subcategory') as HTMLInputElement).value).toBe('Antibiotic');

      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });

      expect((screen.getByLabelText('Subcategory') as HTMLInputElement).value).toBe('');
    });

    it('clears a dependent field error when the source field changes', () => {
      render(
        <EditableAccordion
          title="Classification"
          fields={[
            { label: 'Category', key: 'category', type: 'select', options: ['Medicine', 'Food'] },
            { label: 'Subcategory', key: 'subCategory', type: 'text', required: true },
          ]}
          data={{ category: 'Medicine', subCategory: 'Antibiotic' }}
          defaultOpen
          fieldResets={{ category: ['subCategory'] }}
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Subcategory'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByText('Subcategory is required')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });

      expect(screen.queryByText('Subcategory is required')).not.toBeInTheDocument();
    });

    it('does not clear other fields when a field has no configured resets', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[
            { label: 'Name', key: 'name', type: 'text' },
            { label: 'Nickname', key: 'nickname', type: 'text' },
          ]}
          data={{ name: 'Rex', nickname: 'Rexy' }}
          defaultOpen
          fieldResets={{ name: [] }}
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max' } });

      expect((screen.getByLabelText('Nickname') as HTMLInputElement).value).toBe('Rexy');
    });
  });

  describe('checkbox field', () => {
    it('renders "Yes" in view mode when checked and toggles in edit mode', () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      render(
        <EditableAccordion
          title="Flags"
          fields={[{ label: 'Controlled', key: 'controlled', type: 'checkbox' }]}
          data={{ controlled: 'true' }}
          defaultOpen
          onSave={onSave}
        />
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Toggle Edit'));
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('renders "No" in view mode when unchecked', () => {
      render(
        <EditableAccordion
          title="Flags"
          fields={[{ label: 'Controlled', key: 'controlled', type: 'checkbox' }]}
          data={{ controlled: false }}
          defaultOpen
        />
      );

      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });

  describe('multiSelect initial value parsing', () => {
    it('splits a comma-separated string into an array', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[{ label: 'Tags', key: 'tags', type: 'multiSelect', options: ['A', 'B', 'C'] }]}
          data={{ tags: 'A, B' }}
          defaultOpen
        />
      );

      expect(screen.getByText('A, B')).toBeInTheDocument();
    });

    it('wraps a single non-comma string value into an array', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[{ label: 'Tags', key: 'tags', type: 'multiSelect', options: ['A'] }]}
          data={{ tags: 'A' }}
          defaultOpen
        />
      );

      expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    });
  });

  describe('formatDisplayValue branches', () => {
    it('renders "-" for an empty array value', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[{ label: 'Tags', key: 'tags', type: 'text' }]}
          data={{ tags: [] }}
          defaultOpen
        />
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders "-" for an object value', () => {
      render(
        <EditableAccordion
          title="Meta"
          fields={[{ label: 'Meta', key: 'meta', type: 'text' }]}
          data={{ meta: { a: 1 } }}
          defaultOpen
        />
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders a boolean value as a string', () => {
      render(
        <EditableAccordion
          title="Flag"
          fields={[{ label: 'Flag', key: 'flag', type: 'text' }]}
          data={{ flag: true }}
          defaultOpen
        />
      );

      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  describe('fieldFilter and optionsResolver', () => {
    it('hides fields excluded by fieldFilter', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[
            { label: 'Name', key: 'name', type: 'text' },
            { label: 'Secret', key: 'secret', type: 'text' },
          ]}
          data={{ name: 'Rex', secret: 'hidden' }}
          defaultOpen
          fieldFilter={(key) => key !== 'secret'}
        />
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    });

    it('applies resolved options from optionsResolver in edit mode', () => {
      render(
        <EditableAccordion
          title="Classification"
          fields={[{ label: 'Subcategory', key: 'subCategory', type: 'select', options: [] }]}
          data={{ subCategory: '' }}
          defaultOpen
          optionsResolver={(key) =>
            key === 'subCategory' ? ['Dynamic A', 'Dynamic B'] : undefined
          }
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      expect(screen.getByText('Dynamic A')).toBeInTheDocument();
    });
  });

  describe('footer and dynamicFooter', () => {
    it('renders a static footer', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          footer={<div>Static footer</div>}
        />
      );

      expect(screen.getByText('Static footer')).toBeInTheDocument();
    });

    it('renders a dynamic footer based on current form values', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          dynamicFooter={(values) => <div>Hello {values.name}</div>}
        />
      );

      expect(screen.getByText('Hello Rex')).toBeInTheDocument();
    });
  });

  describe('readOnly behavior', () => {
    it('forces editing off and does not show the edit toggle when readOnly', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          readOnly
        />
      );

      expect(screen.queryByText('Toggle Edit')).not.toBeInTheDocument();
      expect(screen.getByText('Rex')).toBeInTheDocument();
    });
  });

  describe('delete action', () => {
    it('calls onDelete when the delete icon is clicked', () => {
      const onDelete = jest.fn();
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          showDeleteIcon
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('cancel action', () => {
    it('restores original values and exits edit mode on cancel', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Changed' } });
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Toggle Edit')).toBeInTheDocument();
      expect(screen.getByText('Rex')).toBeInTheDocument();
    });
  });

  describe('save error handling', () => {
    it('shows an error message when onSave rejects', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const onSave = jest.fn().mockRejectedValue(new Error('Network error'));

      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          onSave={onSave}
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));

      await act(async () => {
        fireEvent.click(screen.getByText('Save'));
      });

      expect(screen.getByText('Failed to save changes. Please try again.')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe('compactInlineActions and hideInlineActions', () => {
    it('hides the inline action buttons when hideInlineActions is set', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          hideInlineActions
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('number field with currency styling', () => {
    it('renders a $ prefix and strips non-numeric input for a currency number field', () => {
      render(
        <EditableAccordion
          title="Pricing"
          fields={[{ label: 'Selling price', key: 'selling', type: 'number' }]}
          data={{ selling: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Selling price'), { target: { value: '$9a9.9b' } });

      expect((screen.getByLabelText('Selling price') as HTMLInputElement).value).toBe('99.9');
    });
  });

  describe('dropdown field type', () => {
    it('renders a dropdown in edit mode and updates on select', () => {
      render(
        <EditableAccordion
          title="Classification"
          fields={[
            { label: 'Vendor', key: 'vendor', type: 'dropdown', options: ['Acme', 'Globex'] },
          ]}
          data={{ vendor: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'Globex' } });

      expect((screen.getByLabelText('Vendor') as HTMLSelectElement).value).toBe('Globex');
    });

    it('renders the resolved label for a dropdown value in view mode', () => {
      render(
        <EditableAccordion
          title="Classification"
          fields={[
            {
              label: 'Vendor',
              key: 'vendor',
              type: 'dropdown',
              options: [{ label: 'Acme Corp', value: 'acme' }],
            },
          ]}
          data={{ vendor: 'acme' }}
          defaultOpen
        />
      );

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  describe('date field interactions', () => {
    it('sets a value when a date is selected in edit mode', () => {
      render(
        <EditableAccordion
          title="Dates"
          fields={[{ label: 'Birth', key: 'dob', type: 'date' }]}
          data={{ dob: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.click(screen.getByText('Birth'));
      fireEvent.click(screen.getByText('Toggle Edit'));

      expect(screen.getByText('Feb 1, 2024')).toBeInTheDocument();
    });

    it('clears the value when the date is cleared', () => {
      render(
        <EditableAccordion
          title="Dates"
          fields={[{ label: 'Birth', key: 'dob', type: 'date' }]}
          data={{ dob: '2024-02-01' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.click(screen.getByLabelText('clear-Birth'));
      fireEvent.click(screen.getByText('Toggle Edit'));

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders a non-string date value via getFormattedDate in view mode', () => {
      render(
        <EditableAccordion
          title="Dates"
          fields={[{ label: 'Birth', key: 'dob', type: 'date' }]}
          data={{ dob: new Date('2024-02-01') }}
          defaultOpen
        />
      );

      expect(screen.getByText('Feb 1, 2024')).toBeInTheDocument();
    });

    it('parses a slash-formatted date string for the date picker', () => {
      render(
        <EditableAccordion
          title="Dates"
          fields={[{ label: 'Birth', key: 'dob', type: 'date' }]}
          data={{ dob: '01/02/2024' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      expect(screen.getByText('Birth')).toBeInTheDocument();
    });
  });

  describe('timeInput field type', () => {
    it('renders an editable time input and updates its value', () => {
      render(
        <EditableAccordion
          title="Schedule"
          fields={[{ label: 'Start time', key: 'startTime', type: 'timeInput' }]}
          data={{ startTime: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:30' } });
      expect((screen.getByLabelText('Start time') as HTMLInputElement).value).toBe('09:30');
    });

    it('shows "-" in view mode when no time value is set', () => {
      render(
        <EditableAccordion
          title="Schedule"
          fields={[{ label: 'Start time', key: 'startTime', type: 'timeInput' }]}
          data={{ startTime: '' }}
          defaultOpen
        />
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('formats a set time value in view mode', () => {
      render(
        <EditableAccordion
          title="Schedule"
          fields={[{ label: 'Start time', key: 'startTime', type: 'timeInput' }]}
          data={{ startTime: '09:30' }}
          defaultOpen
        />
      );

      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    });
  });

  describe('formatDisplayValue fallback', () => {
    it('renders "-" for values that are not string, number, boolean, or array', () => {
      render(
        <EditableAccordion
          title="Weird"
          fields={[{ label: 'Callback', key: 'callback', type: 'text' }]}
          data={{ callback: () => {} }}
          defaultOpen
        />
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('multiSelect non-array view value', () => {
    it('resolves a non-array value via options when the field is not editable', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[
            {
              label: 'Tags',
              key: 'tags',
              type: 'multiSelect',
              options: [{ label: 'Alpha', value: 'A' }],
              editable: false,
            },
          ]}
          data={{ tags: 'A' }}
          defaultOpen
        />
      );

      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('falls back to the raw value when there are no options', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[{ label: 'Tags', key: 'tags', type: 'multiSelect', editable: false }]}
          data={{ tags: 'RawValue' }}
          defaultOpen
        />
      );

      expect(screen.getByText('RawValue')).toBeInTheDocument();
    });
  });

  describe('required field validation branches', () => {
    it('shows an error for a required multiSelect with no selections', () => {
      render(
        <EditableAccordion
          title="Tags"
          fields={[
            { label: 'Tags', key: 'tags', type: 'multiSelect', options: ['A'], required: true },
          ]}
          data={{ tags: [] }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByText('Tags is required')).toBeInTheDocument();
    });

    it('shows and then clears an error for a required number field', () => {
      render(
        <EditableAccordion
          title="Stock"
          fields={[{ label: 'Quantity', key: 'quantity', type: 'number', required: true }]}
          data={{ quantity: '' }}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByText('Quantity is required')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.queryByText('Quantity is required')).not.toBeInTheDocument();
    });
  });

  describe('data prop changes', () => {
    it('rebuilds form values when the data prop reference changes', () => {
      const { rerender } = render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
        />
      );

      expect(screen.getByText('Rex')).toBeInTheDocument();

      rerender(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Max' }}
          defaultOpen
        />
      );

      expect(screen.getByText('Max')).toBeInTheDocument();
    });
  });

  describe('readOnly toggled mid-edit', () => {
    it('force-closes editing when readOnly flips to true while editing', () => {
      const onEditingChange = jest.fn();
      const { rerender } = render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          onEditingChange={onEditingChange}
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      expect(screen.getByText('Save')).toBeInTheDocument();

      rerender(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          readOnly
          onEditingChange={onEditingChange}
        />
      );

      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(onEditingChange).toHaveBeenCalledWith(false);
    });
  });

  describe('registered startEditing action', () => {
    it('enters edit mode when the registered startEditing action is invoked', () => {
      let actions: any = null;
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          onRegisterActions={(a) => {
            if (a) actions = a;
          }}
        />
      );

      expect(actions.isEditing()).toBe(false);
      act(() => {
        actions.startEditing();
      });
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('compactInlineActions layout', () => {
    it('applies the compact layout classes while editing', () => {
      render(
        <EditableAccordion
          title="Profile"
          fields={[{ label: 'Name', key: 'name', type: 'text' }]}
          data={{ name: 'Rex' }}
          defaultOpen
          compactInlineActions
        />
      );

      fireEvent.click(screen.getByText('Toggle Edit'));
      const saveButton = screen.getByText('Save');
      expect(saveButton.closest('.flex.items-center.justify-center.gap-3')).toBeInTheDocument();
    });
  });
});
