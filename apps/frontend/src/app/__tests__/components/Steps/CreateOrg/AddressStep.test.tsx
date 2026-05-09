import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddressStep from '@/app/features/onboarding/components/Steps/CreateOrg/AddressStep';
import { Organisation } from '@yosemite-crew/types';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text }: { onClick: () => void; text: string }) => (
    <button onClick={onClick} data-testid="next-button">
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: { onClick: () => void; text: string }) => (
    <button onClick={onClick} data-testid="back-button">
      {text}
    </button>
  ),
}));

jest.mock(
  '@/app/ui/inputs/FormInput/FormInput',
  () =>
    ({ inlabel, onChange, value, error }: any) => (
      <div data-testid={`input-wrapper-${inlabel}`}>
        <label>{inlabel}</label>
        <input
          aria-label={inlabel}
          value={value}
          onChange={onChange}
          data-testid={`input-${inlabel}`}
        />
        {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
      </div>
    )
);

jest.mock(
  '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown',
  () =>
    ({ inlabel, onChange, value, error, onAddressSelect }: any) => (
      <div data-testid={`input-wrapper-${inlabel}`}>
        <label>{inlabel}</label>
        <input
          aria-label={inlabel}
          value={value}
          onChange={onChange}
          data-testid={`input-${inlabel}`}
        />
        {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
        <button
          type="button"
          data-testid={`autofill-${inlabel}`}
          onClick={() =>
            onAddressSelect?.({
              addressLine: '1 Autofill St',
              city: 'Autofill City',
              state: 'Autofill State',
              postalCode: '00000',
              country: 'Autofill Country',
            })
          }
        >
          Autofill
        </button>
      </div>
    )
);

describe('AddressStep Component', () => {
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();
  const mockSetFormData = jest.fn();

  const emptyFormData: Organisation = {
    appointmentCheckInBufferMinutes: 5,
    appointmentCheckInRadiusMeters: 200,
    address: {
      addressLine: '',
      city: '',
      state: '',
      postalCode: '',
    },
  } as unknown as Organisation;

  const validFormData: Organisation = {
    appointmentCheckInBufferMinutes: 5,
    appointmentCheckInRadiusMeters: 200,
    address: {
      addressLine: '123 Main St',
      city: 'Tech City',
      state: 'CA',
      postalCode: '90210',
      country: 'United States',
    },
  } as unknown as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all address and check-in fields', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByTestId('input-Address line')).toBeInTheDocument();
    expect(screen.getByTestId('input-City')).toBeInTheDocument();
    expect(screen.getByTestId('input-State/Province')).toBeInTheDocument();
    expect(screen.getByTestId('input-Postal code')).toBeInTheDocument();
    expect(
      screen.getByTestId('input-Check-in opens (minutes before appointment)')
    ).toBeInTheDocument();
    expect(screen.getByTestId('input-Check-in radius (meters)')).toBeInTheDocument();
    expect(screen.getByTestId('back-button')).toBeInTheDocument();
  });

  it('updates form data on input change', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId('input-Address line'), {
      target: { value: 'New Address' },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ addressLine: 'New Address' }),
      })
    );

    fireEvent.change(screen.getByTestId('input-Check-in opens (minutes before appointment)'), {
      target: { value: '15' },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentCheckInBufferMinutes: 15,
      })
    );
  });

  it('autofills all address fields when a place is selected', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId('autofill-Address line'));

    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn(emptyFormData);
    expect(newState.address).toEqual(
      expect.objectContaining({
        addressLine: '1 Autofill St',
        city: 'Autofill City',
        state: 'Autofill State',
        postalCode: '00000',
        country: 'Autofill Country',
      })
    );
  });

  it('shows validation errors if fields are empty on submit', async () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-Address line')).toHaveTextContent(
        'Address line is required'
      );
      expect(screen.getByTestId('error-City')).toHaveTextContent('City is required');
      expect(screen.getByTestId('error-State/Province')).toHaveTextContent(
        'State or province is required'
      );
      expect(screen.getByTestId('error-Postal code')).toHaveTextContent('Postal code is required');
    });

    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it('advances to the next step on successful validation', async () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(mockSetFormData).toHaveBeenCalledWith(validFormData);
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  it('goes back when the Back button is clicked', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId('back-button'));
    expect(mockPrevStep).toHaveBeenCalled();
  });
});
