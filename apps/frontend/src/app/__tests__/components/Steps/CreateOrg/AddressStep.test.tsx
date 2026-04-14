import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddressStep from '@/app/features/onboarding/components/Steps/CreateOrg/AddressStep';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { Organisation } from '@yosemite-crew/types';

// --- Mocks ---
jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));

// Mock Buttons component since it might have complex logic/styles
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text }: { onClick: () => void; text: string }) => (
    <button onClick={onClick} data-testid="next-button">
      {text}
    </button>
  ),
}));

// Mock FormInput to simplify testing
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

// Mock GoogleSearchDropDown — addressLine field uses this instead of FormInput
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
    address: {
      addressLine: '',
      city: '',
      state: '',
      postalCode: '',
    },
  } as unknown as Organisation;

  const validFormData: Organisation = {
    address: {
      addressLine: '123 Main St',
      city: 'Tech City',
      state: 'CA',
      postalCode: '90210',
    },
  } as unknown as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it('renders all address input fields', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText('Address')).toBeInTheDocument(); // step title
    expect(screen.getByTestId('input-Address line')).toBeInTheDocument();
    expect(screen.getByTestId('input-City')).toBeInTheDocument();
    expect(screen.getByTestId('input-State/Province')).toBeInTheDocument();
    expect(screen.getByTestId('input-Postal code')).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toBeInTheDocument();
  });

  // --- Section 2: Input Handling ---
  it('updates form data on input change', () => {
    // We need a wrapper to update local state in the test if we want to simulate controlled inputs perfectly,
    // but verifying the setFormData call is sufficient for unit testing the component's prop usage.
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    const addressInput = screen.getByTestId('input-Address line');
    fireEvent.change(addressInput, { target: { value: 'New Address' } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ addressLine: 'New Address' }),
      })
    );
  });

  it('autofills all address fields when a place is selected from GoogleSearchDropDown', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId('autofill-Address line'));

    // onAddressSelect batches all fields in one setFormData call
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

  it('updates city, state, and postal code correctly', () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId('input-City'), {
      target: { value: 'New City' },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ city: 'New City' }),
      })
    );

    fireEvent.change(screen.getByTestId('input-State/Province'), {
      target: { value: 'NY' },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ state: 'NY' }),
      })
    );

    fireEvent.change(screen.getByTestId('input-Postal code'), {
      target: { value: '10001' },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ postalCode: '10001' }),
      })
    );
  });

  // --- Section 3: Validation ---
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
      expect(screen.getByTestId('error-Address line')).toHaveTextContent('Address is required');
      expect(screen.getByTestId('error-City')).toHaveTextContent('City is required');
      expect(screen.getByTestId('error-State/Province')).toHaveTextContent('State is required');
      expect(screen.getByTestId('error-Postal code')).toHaveTextContent('PostalCode is required');
    });

    expect(updateOrg).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  // --- Section 4: Submission & Error Handling ---
  it('calls updateOrg and nextStep on successful submission', async () => {
    (updateOrg as jest.Mock).mockResolvedValue({});

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
      expect(updateOrg).toHaveBeenCalledWith(validFormData);
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  it('logs error if updateOrg fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network Error');
    (updateOrg as jest.Mock).mockRejectedValue(error);

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
      expect(updateOrg).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error updating organization:', error);
      expect(mockNextStep).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
