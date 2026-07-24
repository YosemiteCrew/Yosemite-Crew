import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalStep, {
  type StepHandle,
} from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';
import { createUserProfile } from '@/app/features/organization/services/profileService';
import { validatePhone } from '@/app/lib/validators';
import { CountryDialCodeOptions } from '@/app/features/companions/components/AddCompanion/type';

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
    <input aria-label={inlabel || label} value={value ?? ''} onChange={onChange} />
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
    <button type="button" onClick={() => setImageUrl('s3-key-abc')}>
      upload-logo
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
  default: ({ onSelect, hasError }: any) => (
    <div>
      <input
        aria-label="country-code-select"
        onChange={(e) => onSelect({ value: e.target.value })}
      />
      {hasError ? <div>country-code-error</div> : null}
    </div>
  ),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  createUserProfile: jest.fn(),
}));

jest.mock('@/app/lib/validators', () => ({
  getCountryCode: () => null,
  validatePhone: jest.fn(() => false),
}));

jest.mock('@/app/lib/date', () => ({
  formatDateLocal: () => '1990-01-01',
}));

const mockValidatePhone = validatePhone as jest.Mock;
const mockCreateUserProfile = createUserProfile as jest.Mock;

const validFormData = {
  _id: 'u-1',
  organizationId: 'o-1',
  personalDetails: {
    gender: 'MALE',
    dateOfBirth: '1990-01-01',
    phoneNumber: '+12025550123',
    address: {
      addressLine: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'United States',
    },
  },
} as any;

// A stateful harness so setFormData actually invokes the updater callbacks
// (needed to exercise the setFormData((prev) => ...) code paths).
function Harness({
  initialFormData,
  orgId = 'org-1',
  isSaving = false,
  nextStep = jest.fn(),
  stepRef,
}: {
  initialFormData?: any;
  orgId?: string | null;
  isSaving?: boolean;
  nextStep?: () => void;
  stepRef?: React.Ref<StepHandle>;
}) {
  const [formData, setFormData] = useState<any>(initialFormData ?? { _id: '', organizationId: '' });
  return (
    <>
      <div data-testid="phone-val">{formData.personalDetails?.phoneNumber || ''}</div>
      <div data-testid="gender-val">{formData.personalDetails?.gender || ''}</div>
      <div data-testid="country-val">{formData.personalDetails?.address?.country || ''}</div>
      <div data-testid="profile-url">{formData.personalDetails?.profilePictureUrl || ''}</div>
      <div data-testid="addr-line">{formData.personalDetails?.address?.addressLine || ''}</div>
      <div data-testid="city-val">{formData.personalDetails?.address?.city || ''}</div>
      <div data-testid="state-val">{formData.personalDetails?.address?.state || ''}</div>
      <div data-testid="postal-val">{formData.personalDetails?.address?.postalCode || ''}</div>
      <PersonalStep
        nextStep={nextStep}
        formData={formData}
        setFormData={setFormData}
        orgIdFromQuery={orgId}
        isSaving={isSaving}
        setIsSaving={jest.fn()}
        ref={stepRef}
      />
    </>
  );
}

const altCountry =
  CountryDialCodeOptions.find((o) => o.dialCode !== '+1' && Boolean(o.dialCode)) ??
  CountryDialCodeOptions[1];

describe('PersonalStep', () => {
  beforeEach(() => {
    mockValidatePhone.mockReset();
    mockValidatePhone.mockReturnValue(false);
    mockCreateUserProfile.mockReset();
    mockCreateUserProfile.mockResolvedValue(undefined);
  });

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

  it('rejects an unparseable date of birth with the minimum-age error', () => {
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: { dateOfBirth: 'not-a-real-date' },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('You must be at least 16 years old')).toBeInTheDocument();
  });

  it('rejects a date of birth younger than the minimum age', () => {
    const today = new Date();
    const recentDob = `${today.getFullYear()}-01-01`;

    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={
          {
            _id: '',
            organizationId: '',
            personalDetails: { dateOfBirth: recentDob },
          } as any
        }
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('You must be at least 16 years old')).toBeInTheDocument();
  });

  it('flags an invalid phone number when validatePhone fails', () => {
    mockValidatePhone.mockReturnValue(false);

    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={validFormData}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
  });

  it('creates the profile and advances to the next step on success', async () => {
    mockValidatePhone.mockReturnValue(true);
    mockCreateUserProfile.mockResolvedValue(undefined);
    const nextStep = jest.fn();

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={validFormData}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-9'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mockCreateUserProfile).toHaveBeenCalledWith(validFormData, 'org-9');
    });
    expect(nextStep).toHaveBeenCalled();
  });

  it('logs an error and does not advance when profile creation fails', async () => {
    mockValidatePhone.mockReturnValue(true);
    mockCreateUserProfile.mockRejectedValue(new Error('boom'));
    // Silence just the single expected console.error (jest.setup makes it throw otherwise).
    (console.error as jest.Mock).mockImplementationOnce(() => {});
    const nextStep = jest.fn();

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={validFormData}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error creating profile:', expect.any(Error));
    });
    expect(nextStep).not.toHaveBeenCalled();
  });

  it('does nothing when Next is clicked while already saving', () => {
    const nextStep = jest.fn();

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={validFormData}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={true}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));

    expect(mockCreateUserProfile).not.toHaveBeenCalled();
    expect(nextStep).not.toHaveBeenCalled();
  });

  it('exposes validate() via ref returning false and setting errors for an empty form', () => {
    const ref = React.createRef<StepHandle>();
    render(
      <PersonalStep
        ref={ref}
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '' } as any}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    let result: boolean | undefined;
    act(() => {
      result = ref.current?.validate();
    });

    expect(result).toBe(false);
    expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
  });

  it('exposes validate() via ref returning true for a valid form', () => {
    mockValidatePhone.mockReturnValue(true);
    const ref = React.createRef<StepHandle>();
    render(
      <PersonalStep
        ref={ref}
        nextStep={jest.fn()}
        formData={validFormData}
        setFormData={jest.fn()}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    let result: boolean | undefined;
    act(() => {
      result = ref.current?.validate();
    });

    expect(result).toBe(true);
  });

  it('selects a gender when a gender option is clicked', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    expect(screen.getByTestId('gender-val')).toHaveTextContent('MALE');
  });

  it('sanitises phone input and prefixes the dial code, and clears when no digits remain', () => {
    render(<Harness />);

    const phoneInput = screen.getByLabelText('Phone number');
    fireEvent.change(phoneInput, { target: { value: '20-25-550123' } });
    expect(screen.getByTestId('phone-val').textContent).toContain('2025550123');
    expect(screen.getByTestId('phone-val').textContent?.startsWith('+')).toBe(true);

    fireEvent.change(phoneInput, { target: { value: 'abc' } });
    expect(screen.getByTestId('phone-val').textContent).toBe('');
  });

  it('updates the dial code and rebuilds the phone number when a country is selected', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '2025550123' } });
    fireEvent.change(screen.getByLabelText('country-code-select'), {
      target: { value: altCountry.value },
    });

    expect(screen.getByTestId('country-val').textContent).toBe(altCountry.countryName);
    expect(screen.getByTestId('phone-val').textContent).toBe(`${altCountry.dialCode}2025550123`);
  });

  it('sets an empty phone number when a country is selected with no local number', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('country-code-select'), {
      target: { value: altCountry.value },
    });

    expect(screen.getByTestId('country-val').textContent).toBe(altCountry.countryName);
    expect(screen.getByTestId('phone-val').textContent).toBe('');
  });

  it('ignores an unknown country code selection', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('country-code-select'), {
      target: { value: 'DEFINITELY-NOT-A-REAL-OPTION' },
    });

    expect(screen.getByTestId('country-val').textContent).toBe('');
  });

  it('stores the uploaded profile picture URL', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'upload-logo' }));

    expect(screen.getByTestId('profile-url').textContent).toContain('s3-key-abc');
  });

  it('updates address, city, state and postal code fields', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Address line 1'), { target: { value: '99 Broadway' } });
    expect(screen.getByTestId('addr-line').textContent).toBe('99 Broadway');

    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Boston' } });
    expect(screen.getByTestId('city-val').textContent).toBe('Boston');

    fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'MA' } });
    expect(screen.getByTestId('state-val').textContent).toBe('MA');

    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '02108' } });
    expect(screen.getByTestId('postal-val').textContent).toBe('02108');
  });

  it('builds address updates from an empty personalDetails object', () => {
    const setFormData = jest.fn();
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: '', organizationId: '' } as any}
        setFormData={setFormData}
        orgIdFromQuery={'org-1'}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Address line 1'), { target: { value: 'Line 1' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'City 1' } });
    fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'State 1' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '00000' } });

    // Each field-change handler builds a fresh object off the (empty) personalDetails.
    expect(setFormData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        personalDetails: expect.objectContaining({
          address: expect.objectContaining({ postalCode: '00000' }),
        }),
      })
    );
    const objectCalls = setFormData.mock.calls.filter(([arg]) => typeof arg !== 'function');
    expect(objectCalls).toHaveLength(4);
  });
});
