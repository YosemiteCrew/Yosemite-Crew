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
  default: ({ placeholder, value, options, onChange }: any) => (
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
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ setCurrentDate, placeholder }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date('2024-02-01'))}>
      {placeholder}
    </button>
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
  formatDisplayDate: () => 'Feb 1, 2024',
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
});
