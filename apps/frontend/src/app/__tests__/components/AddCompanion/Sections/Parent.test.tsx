import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Parent from '@/app/features/companions/components/AddCompanion/Sections/Parent';
import { EMPTY_STORED_PARENT } from '@/app/features/companions/components/AddCompanion/type';
import { validatePhone } from '@/app/lib/validators';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const FieldMock = ({ error, inlabel, value = '', onChange }: any) => (
  <div>
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
    </label>
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ error, inlabel, value = '', onChange, onAddressSelect }: any) => (
    <div>
      <label>
        {inlabel}
        <input aria-label={inlabel} value={value} onChange={onChange} />
      </label>
      <button
        type="button"
        onClick={() =>
          onAddressSelect?.({
            addressLine: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
            city: 'Mountain View',
            state: 'CA',
            postalCode: '94043',
            country: 'United States',
          })
        }
      >
        autofill-address
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ error }: any) => (error ? <div>{error}</div> : <div />),
}));

jest.mock('@/app/ui/inputs/Search', () => ({
  __esModule: true,
  default: () => <div>search</div>,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: () => <div>label</div>,
}));

jest.mock('@/app/features/companions/services/companionService', () => ({
  searchParent: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/lib/validators', () => ({
  getCountryCode: () => null,
  getEmailValidationError: jest.fn(() => null),
  normalizeEmail: jest.fn((value: string) => value.trim()),
  validatePhone: jest.fn(() => true),
}));

const { getEmailValidationError } = jest.requireMock('@/app/lib/validators') as {
  getEmailValidationError: jest.Mock;
};

describe('AddCompanion Parent section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validatePhone as jest.Mock).mockReturnValue(true);
    getEmailValidationError.mockImplementation((value: string) =>
      value.trim() ? null : 'Email is required'
    );
  });

  it('shows validation errors when required fields are empty', () => {
    render(
      <Parent setActiveLabel={jest.fn()} formData={EMPTY_STORED_PARENT} setFormData={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Number is required')).toBeInTheDocument();
    expect(screen.getByText('Address is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByText('State/Province is required')).toBeInTheDocument();
    expect(screen.getByText('Postal code is required')).toBeInTheDocument();
  });

  it('shows phone validation error when number is invalid', () => {
    (validatePhone as jest.Mock).mockReturnValue(false);

    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_PARENT,
          firstName: 'Parent',
          lastName: 'User',
          email: 'parent@example.com',
          phoneNumber: '+1123',
          address: {
            ...EMPTY_STORED_PARENT.address,
            addressLine: '123 Main Street',
            city: 'Austin',
            state: 'TX',
            postalCode: '73301',
          },
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
  });

  it('shows email validation error when email format is invalid', () => {
    getEmailValidationError.mockReturnValue('Enter a valid email');

    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_PARENT,
          firstName: 'Parent',
          lastName: 'User',
          email: 'bad-email',
          phoneNumber: '+14155552671',
          address: {
            ...EMPTY_STORED_PARENT.address,
            addressLine: '123 Main Street',
            city: 'Austin',
            state: 'TX',
            postalCode: '73301',
          },
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('autofills address details from google places selection', () => {
    const setFormData = jest.fn();

    render(
      <Parent setActiveLabel={jest.fn()} formData={EMPTY_STORED_PARENT} setFormData={setFormData} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'autofill-address' }));

    expect(setFormData).toHaveBeenCalledWith(expect.any(Function));

    const update = setFormData.mock.calls.at(-1)?.[0];
    const nextState = update(EMPTY_STORED_PARENT);

    expect(nextState.address).toEqual(
      expect.objectContaining({
        addressLine: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
        city: 'Mountain View',
        state: 'CA',
        postalCode: '94043',
        country: 'United States',
      })
    );
  });
});
