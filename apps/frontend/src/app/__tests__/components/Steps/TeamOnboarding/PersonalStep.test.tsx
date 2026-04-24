import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

const FieldMock = ({ error, inlabel, label }: any) => (
  <div>
    <span>{inlabel || label}</span>
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
  default: () => <div>logo</div>,
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ error }: any) => (error ? <div>{error}</div> : <div />),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  createUserProfile: jest.fn(),
}));

jest.mock('@/app/lib/validators', () => ({
  getCountryCode: () => null,
  validatePhone: () => false,
}));

jest.mock('@/app/lib/date', () => ({
  formatDateLocal: () => '2024-01-01',
}));

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
});
