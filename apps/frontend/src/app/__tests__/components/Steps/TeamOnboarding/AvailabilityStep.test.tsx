import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AvailabilityStep from '@/app/features/onboarding/components/Steps/TeamOnboarding/AvailabilityStep';
import type { StepHandle } from '@/app/features/onboarding/components/Steps/TeamOnboarding/PersonalStep';
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

/**
 * Captures the props the component hands to <Primary>. The real Primary renders a
 * `disabled` <button> while saving, so a click cannot reach onClick — the only way to
 * exercise the handler's `if (isSaving) return` double-submit guard is to invoke the
 * handler through the button's own wiring.
 */
const mockPrimaryProps: { current: any } = { current: null };

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: (props: any) => {
    mockPrimaryProps.current = props;
    const { onClick, text, isDisabled } = props;
    return (
      <button data-testid="btn-finish" onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    );
  },
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

    expect(screen.getByText('Weekly availability')).toBeInTheDocument();
    expect(screen.getByTestId('availability-component')).toBeInTheDocument();
    expect(screen.getByTestId('btn-finish')).toBeInTheDocument();
    expect(screen.getByTestId('btn-back')).toBeInTheDocument();
  });

  /**
   * Regression guard. These controls once held local state that `handleSaveAvailability` never
   * sent — `upsertAvailability` only ever receives `convertAvailability(availability)`, and the
   * base-availability API has no field for slot length or visit modality. Any selection was
   * therefore silently discarded on Finish. They must stay non-interactive until the API
   * persists them; if you wire them into the payload, replace these tests with ones asserting
   * the saved payload carries the choice.
   */
  it('renders the consultation-slot selector disabled at the default the API applies', () => {
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

    const slot = screen.getByLabelText('Consultation slot') as HTMLSelectElement;
    expect(slot.value).toBe('30 min');
    expect(slot).toBeDisabled();
  });

  it('renders the consultation-type pills disabled so a discarded choice cannot be made', () => {
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

    const inClinic = screen.getByRole('button', { name: 'In clinic' });
    const homeVisits = screen.getByRole('button', { name: 'Home visits' });

    expect(inClinic).toHaveAttribute('aria-pressed', 'true');
    expect(homeVisits).toHaveAttribute('aria-pressed', 'false');
    expect(inClinic).toBeDisabled();
    expect(homeVisits).toBeDisabled();

    // Clicking must not move the pills off the defaults the backend actually applies.
    fireEvent.click(homeVisits);
    fireEvent.click(inClinic);

    expect(inClinic).toHaveAttribute('aria-pressed', 'true');
    expect(homeVisits).toHaveAttribute('aria-pressed', 'false');
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

    // The saved payload is exactly the converted availability — the API takes nothing else,
    // so no consultation slot/type data may be smuggled in alongside it.
    const [payload, ...rest] = (upsertAvailability as jest.Mock).mock.calls[0];
    expect(payload).toBe(mockConvertedData);
    expect(rest).toEqual([mockOrgId]);
  });

  it('ignores a submit that arrives while a save is already in flight', async () => {
    const mockSetIsSaving = jest.fn();

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={true}
        setIsSaving={mockSetIsSaving}
        setIsRedirecting={jest.fn()}
      />
    );

    await act(async () => {
      await mockPrimaryProps.current.onClick();
    });

    expect(convertAvailability).not.toHaveBeenCalled();
    expect(upsertAvailability).not.toHaveBeenCalled();
    expect(mockSetIsSaving).not.toHaveBeenCalled();
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

  // --- Section 4: Imperative ref validation ---
  it('exposes validate() on the ref which returns false and shows the error when no slot is set', () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);
    const ref = React.createRef<StepHandle>();

    render(
      <AvailabilityStep
        ref={ref}
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    let result: boolean | undefined;
    act(() => {
      result = ref.current?.validate();
    });

    expect(result).toBe(false);
    expect(convertAvailability).toHaveBeenCalledWith(mockAvailabilityState);
    expect(
      screen.getByText('Please enable at least one day with a valid time slot')
    ).toBeInTheDocument();
  });

  it('exposes validate() on the ref which returns true and clears the error when a slot is set', () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);
    const ref = React.createRef<StepHandle>();

    render(
      <AvailabilityStep
        ref={ref}
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
        isSaving={false}
        setIsSaving={jest.fn()}
        setIsRedirecting={jest.fn()}
      />
    );

    // First fail so the error is on screen, then confirm a passing validate clears it.
    act(() => {
      ref.current?.validate();
    });
    expect(
      screen.getByText('Please enable at least one day with a valid time slot')
    ).toBeInTheDocument();

    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);

    let result: boolean | undefined;
    act(() => {
      result = ref.current?.validate();
    });

    expect(result).toBe(true);
    expect(
      screen.queryByText('Please enable at least one day with a valid time slot')
    ).not.toBeInTheDocument();
  });

  // --- Section 5: Error Handling ---
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
