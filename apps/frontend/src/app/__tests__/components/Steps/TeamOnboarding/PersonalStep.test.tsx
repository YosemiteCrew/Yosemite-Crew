import React, { useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalStep, {
  type StepHandle,
} from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';
import { createUserProfile } from '@/app/features/organization/services/profileService';
import { validatePhone } from '@/app/lib/validators';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

const FieldMock = ({ error, inlabel, label, inname, value, onChange }: any) => (
  <div>
    <span>{inlabel || label}</span>
    <input aria-label={inname || inlabel || label} value={value ?? ''} onChange={onChange} />
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock('@/app/ui/widgets/UploadImage/LogoUploader', () => ({
  __esModule: true,
  default: ({ setImageUrl }: any) => (
    <button type="button" onClick={() => setImageUrl('key/avatar.png')}>
      logo
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ error, setCurrentDate }: any) => (
    <div>
      <button type="button" onClick={() => setCurrentDate(new Date('2000-01-01'))}>
        set-dob
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, hasError }: any) => (
    <div>
      <span>{placeholder}</span>
      <button type="button" onClick={() => onSelect({ value: 'US' })}>
        select-country
      </button>
      {hasError ? <div>Phone number is required</div> : null}
    </div>
  ),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  createUserProfile: jest.fn(),
}));

jest.mock('@/app/lib/validators', () => ({
  getCountryCode: () => null,
  validatePhone: jest.fn().mockReturnValue(false),
}));

jest.mock('@/app/lib/date', () => ({
  formatDateLocal: () => '2024-01-01',
}));

jest.mock('@/app/features/companions/components/AddCompanion/type', () => {
  const actual = jest.requireActual('@/app/features/companions/components/AddCompanion/type');
  return {
    ...actual,
    CountryDialCodeOptions: [
      { value: 'US', dialCode: '+1', countryName: 'United States' },
      { value: 'IN', dialCode: '+91', countryName: 'India' },
    ],
  };
});

describe('PersonalStep', () => {
  it('shows validation errors when required fields are missing', () => {
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '' } as any}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
    // Phone error appears in both country code dropdown and inline error div
    expect(screen.getAllByText('Phone number is required').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Address is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByText('State / Province is required')).toBeInTheDocument();
    expect(screen.getByText('Postal code is required')).toBeInTheDocument();
  });

  it('shows gender error when gender is missing', () => {
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '' } as any}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Gender is required')).toBeInTheDocument();
  });

  it('does nothing on Next click while already saving', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '' } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));
    // no validation errors are computed/rendered because handleNext returns early
    expect(screen.queryByText('Date of birth is required')).not.toBeInTheDocument();
  });

  it('selects a gender option and updates formData', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '', personalDetails: {} } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        personalDetails: expect.objectContaining({ gender: 'MALE' }),
      })
    );
  });

  it('updates phone number and country code via handlePhoneChange/handleCountryCodeSelect', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '', personalDetails: {} } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'select-country' }));
    expect(setFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'number' }), {
      target: { value: '12a3' },
    });
    expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates address, city, state, and postal code fields', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '', personalDetails: {} } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'address line' }), {
      target: { value: '123 Main St' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'city' }), {
      target: { value: 'Springfield' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'state' }), {
      target: { value: 'IL' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'postal code' }), {
      target: { value: '62704' },
    });

    const lastCallArg = setFormData.mock.calls.at(-1)?.[0];
    expect(lastCallArg.personalDetails.address.postalCode).toBe('62704');
  });

  it('sets the profile picture URL via LogoUploader', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '', personalDetails: {} } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'logo' }));
    expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
  });

  it('sets the date of birth via Datepicker (triggers the formData sync effect)', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '', personalDetails: {} } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-dob' }));
    expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
  });

  it('saves successfully and calls nextStep', async () => {
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createUserProfile as jest.Mock).mockResolvedValueOnce(undefined);
    const nextStep = jest.fn();
    const setIsSaving = jest.fn();

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: {
              dateOfBirth: '1990-01-01',
              gender: 'MALE',
              phoneNumber: '+11234567890',
              address: {
                addressLine: '123 Main St',
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
              },
            },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={setIsSaving}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(nextStep).toHaveBeenCalledTimes(1));
    expect(createUserProfile).toHaveBeenCalled();
    expect(setIsSaving).toHaveBeenCalledWith(true);
    expect(setIsSaving).toHaveBeenCalledWith(false);
  });

  it('logs an error and does not advance when createUserProfile rejects', async () => {
    (validatePhone as jest.Mock).mockReturnValue(true);
    const error = new Error('save failed');
    (createUserProfile as jest.Mock).mockRejectedValueOnce(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const nextStep = jest.fn();

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: {
              dateOfBirth: '1990-01-01',
              gender: 'MALE',
              phoneNumber: '+11234567890',
              address: {
                addressLine: '123 Main St',
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
              },
            },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(nextStep).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('exposes a validate() handle via ref that returns false on invalid data and true on valid data', () => {
    function Harness({ valid }: { valid: boolean }) {
      const ref = useRef<StepHandle>(null);
      const [result, setResult] = React.useState<string>('');
      const formData = valid
        ? ({
            _id: '',
            organizationId: '',
            personalDetails: {
              dateOfBirth: '1990-01-01',
              gender: 'MALE',
              phoneNumber: '+11234567890',
              address: {
                addressLine: '123 Main St',
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
              },
            },
          } as any)
        : ({ _id: '', organizationId: '' } as any);

      return (
        <div>
          <PersonalStep
            ref={ref}
            nextStep={jest.fn()}
            formData={formData}
            setFormData={jest.fn()}
            orgIdFromQuery="org-1"
            isSaving={false}
            setIsSaving={jest.fn()}
          />
          <button type="button" onClick={() => setResult(String(ref.current?.validate()))}>
            run-validate
          </button>
          <div data-testid="result">{result}</div>
        </div>
      );
    }

    (validatePhone as jest.Mock).mockReturnValue(true);
    const { unmount } = render(<Harness valid={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'run-validate' }));
    expect(screen.getByTestId('result').textContent).toBe('false');
    unmount();

    render(<Harness valid />);
    fireEvent.click(screen.getByRole('button', { name: 'run-validate' }));
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  it('treats a date of birth younger than the minimum age as invalid', () => {
    (validatePhone as jest.Mock).mockReturnValue(true);
    const recentYear = new Date().getFullYear() - 1;
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: {
              dateOfBirth: `${recentYear}-01-01`,
              gender: 'MALE',
              phoneNumber: '+11234567890',
              address: {
                addressLine: '123 Main St',
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
              },
            },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText(/You must be at least \d+ years old/)).toBeInTheDocument();
  });

  it('treats an invalid (unparseable) date of birth as invalid', () => {
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: { dateOfBirth: 'not-a-date' },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText(/You must be at least \d+ years old/)).toBeInTheDocument();
  });
});
