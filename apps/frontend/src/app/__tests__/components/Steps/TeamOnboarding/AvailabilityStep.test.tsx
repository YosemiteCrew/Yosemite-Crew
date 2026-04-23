import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AvailabilityStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/AvailabilityStep';
import { upsertAvailability } from '@/app/features/organization/services/availabilityService';
import {
  convertAvailability,
  hasAtLeastOneAvailability,
} from '@/app/features/appointments/components/Availability/utils';

// --- Mocks ---

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  upsertAvailability: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Availability/Availability', () => () => (
  <div data-testid="availability-component">Mock Availability UI</div>
));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ onClick, text, isDisabled }: any) => (
    <button data-testid="btn-finish" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ onClick, text }: any) => (
    <button data-testid="btn-back" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('AvailabilityStep Component', () => {
  const mockPrevStep = jest.fn();
  const mockSetAvailability = jest.fn();
  const mockOrgId = 'org-123';
  const mockAvailabilityState = { monday: [] } as any;
  const mockConvertedData = [{ day: 'monday', slots: [] }];

  beforeEach(() => {
    jest.clearAllMocks();
    (convertAvailability as jest.Mock).mockReturnValue(mockConvertedData);
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- Section 1: Rendering ---
  it('renders the container, title, Back and Finish buttons', () => {
    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByTestId('availability-component')).toBeInTheDocument();
    expect(screen.getByTestId('btn-finish')).toBeInTheDocument();
    expect(screen.getByTestId('btn-back')).toBeInTheDocument();
  });

  it('calls prevStep when Back is clicked', () => {
    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-back'));
    expect(mockPrevStep).toHaveBeenCalled();
  });

  // --- Section 2: Validation (No Slots) ---
  it('shows inline error and aborts submission if no availability is selected', async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-finish'));

    await waitFor(() => {
      expect(
        screen.getByText('Please enable at least one day with a valid time slot')
      ).toBeInTheDocument();
    });

    expect(upsertAvailability).not.toHaveBeenCalled();
  });

  // --- Section 3: Successful Submission ---
  it('converts data and calls upsertAvailability on success', async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
    (upsertAvailability as jest.Mock).mockResolvedValue({});

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-finish'));

    await waitFor(() => {
      expect(convertAvailability).toHaveBeenCalledWith(mockAvailabilityState);
      expect(upsertAvailability).toHaveBeenCalledWith(mockConvertedData, mockOrgId);
    });
  });

  it('shows Saving... text and disabled button when isSaving is true', () => {
    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={true}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('calls setIsSaving when Finish is clicked', async () => {
    const mockSetIsSaving = jest.fn();
    (upsertAvailability as jest.Mock).mockResolvedValue({});

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={mockSetIsSaving}
        setIsRedirecting={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-finish'));

    await waitFor(() => {
      expect(mockSetIsSaving).toHaveBeenCalledWith(true);
    });
  });

  // --- Section 4: Error Handling ---
  it('catches and logs errors from upsertAvailability', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network Error');
    (upsertAvailability as jest.Mock).mockRejectedValue(error);

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-finish'));

    await waitFor(() => {
      expect(upsertAvailability).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(error);
    });

    consoleSpy.mockRestore();
  });
});
