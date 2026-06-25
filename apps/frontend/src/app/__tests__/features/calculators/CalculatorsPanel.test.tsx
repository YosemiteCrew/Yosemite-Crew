import { render, screen } from '@testing-library/react';
import type { Appointment } from '@yosemite-crew/types';
import CalculatorsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/CalculatorsPanel';
import { useCompanionStore } from '@/app/stores/companionStore';

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: jest.fn(),
}));

type Record = { type?: string; currentWeight?: number };

const mockCompanion = (record: Record | undefined) => {
  (useCompanionStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: unknown) => unknown) =>
      selector({ companionsById: record ? { c1: record } : {} })
  );
};

const appointment = {
  companion: { id: 'c1', name: 'Doggy', species: 'Canine', parent: { id: 'p1', name: 'Owner' } },
} as unknown as Appointment;

describe('CalculatorsPanel', () => {
  it('pre-fills weight (converted to kg) and species from the patient', () => {
    mockCompanion({ type: 'dog', currentWeight: 15 });
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.getByText(/Pre-filled from Doggy: 15 lbs \(6\.8 kg\), dog/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);
  });

  it('shows no pre-fill note when the patient has no recorded weight', () => {
    mockCompanion({ type: 'cat' });
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.queryByText(/Pre-filled from/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null);
  });

  it('falls back gracefully when no companion record is loaded', () => {
    mockCompanion(undefined);
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.queryByText(/Pre-filled from/i)).not.toBeInTheDocument();
  });
});
