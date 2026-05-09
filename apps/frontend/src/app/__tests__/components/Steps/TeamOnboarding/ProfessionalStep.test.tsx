import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfessionalStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/ProfessionalStep';
import { updateUserProfile } from '@/app/features/organization/services/profileService';
import { UserProfile } from '@/app/features/users/types/profile';

// --- Mocks ---

jest.mock('@/app/features/organization/services/profileService', () => ({
  updateUserProfile: jest.fn(),
}));

jest.mock(
  '@/app/ui/inputs/FormInput/FormInput',
  () =>
    ({ inname, onChange, value, error, inlabel }: any) => (
      <div data-testid={`wrapper-${inname}`}>
        <label>{inlabel}</label>
        <input data-testid={`input-${inname}`} name={inname} value={value} onChange={onChange} />
        {error && error.trim() && <span data-testid={`error-${inname}`}>{error}</span>}
      </div>
    )
);

jest.mock(
  '@/app/ui/inputs/FormDesc/FormDesc',
  () =>
    ({ inname, onChange, value, error, inlabel }: any) => (
      <div data-testid={`wrapper-${inname}`}>
        <label>{inlabel}</label>
        <textarea data-testid={`input-${inname}`} name={inname} value={value} onChange={onChange} />
        {error && <span data-testid={`error-${inname}`}>{error}</span>}
      </div>
    )
);

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button data-testid="btn-back" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('ProfessionalStep Component', () => {
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();
  const mockSetFormData = jest.fn();
  const mockOrgId = 'org-123';

  const emptyFormData: UserProfile = {
    professionalDetails: {
      linkedin: '',
      medicalLicenseNumber: '',
      yearsOfExperience: undefined,
      specialization: '',
      qualification: '',
      biography: '',
    },
  } as unknown as UserProfile;

  const validFormData: UserProfile = {
    professionalDetails: {
      linkedin: 'https://linkedin.com/in/test',
      medicalLicenseNumber: 'LIC-123',
      yearsOfExperience: 5,
      specialization: 'General Surgery',
      qualification: 'MD',
      biography: 'Bio text',
    },
  } as unknown as UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it('renders all inputs correctly', () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    expect(screen.getByText('Professional details')).toBeInTheDocument();
    expect(screen.getByTestId('input-linkedin')).toBeInTheDocument();
    expect(screen.getByTestId('input-license number')).toBeInTheDocument();
    expect(screen.getByTestId('input-Years of experience')).toBeInTheDocument();
    expect(screen.getByTestId('input-Specialisation')).toBeInTheDocument();
    expect(screen.getByTestId('input-Qualification')).toBeInTheDocument();
    expect(screen.getByTestId('input-Biography')).toBeInTheDocument();
    expect(screen.getByTestId('btn-next')).toBeInTheDocument();
    expect(screen.getByTestId('btn-back')).toBeInTheDocument();
  });

  // --- Section 2: Input & State Handling ---
  it('updates form data on input change', () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('input-linkedin'), { target: { value: 'link' } });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-license number'), { target: { value: '123' } });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-Years of experience'), {
      target: { value: '5' },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-Specialisation'), { target: { value: 'Cardio' } });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-Qualification'), { target: { value: 'MBBS' } });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-Biography'), { target: { value: 'My Bio' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // --- Section 3: Validation ---
  it('shows errors for missing required fields', async () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(screen.getByTestId('error-Years of experience')).toHaveTextContent(
        'Years of experience is required'
      );
      expect(screen.getByTestId('error-Specialisation')).toHaveTextContent(
        'Specialisation is required'
      );
      expect(screen.getByTestId('error-Qualification')).toHaveTextContent(
        'Qualification is required'
      );
    });

    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('shows error for invalid LinkedIn URL', async () => {
    const badLinkedin: UserProfile = {
      professionalDetails: {
        linkedin: 'not-a-linkedin-url',
        yearsOfExperience: 5,
        specialization: 'General',
        qualification: 'MD',
      },
    } as unknown as UserProfile;

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={badLinkedin}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(screen.getByTestId('error-linkedin')).toHaveTextContent(
        'Enter a valid LinkedIn profile URL'
      );
    });
  });

  it('shows error for out-of-range years of experience', async () => {
    const badYears: UserProfile = {
      professionalDetails: {
        linkedin: '',
        yearsOfExperience: 99,
        specialization: 'General',
        qualification: 'MD',
      },
    } as unknown as UserProfile;

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={badYears}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(screen.getByTestId('error-Years of experience')).toHaveTextContent(
        'Enter a value between 0 and 60'
      );
    });
  });

  it('handles null/undefined professionalDetails gracefully during validation', async () => {
    const nullData = {} as UserProfile;

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={nullData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(screen.getByText('Professional details')).toBeInTheDocument();
    });

    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  // --- Section 4: Submission & Error Handling ---
  it('submits successfully and calls nextStep when data is valid', async () => {
    (updateUserProfile as jest.Mock).mockResolvedValue({});

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(validFormData, mockOrgId);
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  it('calls prevStep when Back is clicked', () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-back'));
    expect(mockPrevStep).toHaveBeenCalled();
  });

  it('logs error if API update fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (updateUserProfile as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
        isSaving={false}
        setIsSaving={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-next'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating profile:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
