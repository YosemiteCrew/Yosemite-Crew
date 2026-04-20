import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgStep from '@/app/features/onboarding/components/Steps/CreateOrg/OrgStep';
import { Organisation } from '@yosemite-crew/types';

jest.mock('@/app/lib/validators', () => ({
  validatePhone: jest.fn(),
}));

jest.mock('@/app/ui/widgets/UploadImage/LogoUploader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, error }: any) => (
    <div>
      <button type="button" onClick={() => onSelect({ value: 'USA', label: 'USA' })}>
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

const validators = jest.requireMock('@/app/lib/validators');

describe('OrgStep', () => {
  const nextStep = jest.fn();
  const setFormData = jest.fn();

  const baseFormData: Organisation = {
    name: '',
    phoneNo: '',
    taxId: '',
    address: { country: '' },
  } as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors for required fields', () => {
    validators.validatePhone.mockReturnValue(false);

    render(<OrgStep nextStep={nextStep} formData={baseFormData} setFormData={setFormData} />);

    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Organisation name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
    expect(screen.getByText('Tax ID is required')).toBeInTheDocument();
    expect(nextStep).not.toHaveBeenCalled();
  });

  it('normalizes form data locally and advances on valid data', () => {
    validators.validatePhone.mockReturnValue(true);

    render(
      <OrgStep
        nextStep={nextStep}
        formData={{
          ...baseFormData,
          name: 'Vet Clinic',
          phoneNo: '123456',
          taxId: 'TX-1',
          DUNSNumber: '123456789',
          address: { country: 'USA' },
        }}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText('Next'));

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ country: 'United States' }),
        phoneNo: '+1123456',
      })
    );
    expect(nextStep).toHaveBeenCalled();
  });
});
