import { render, screen } from '@testing-library/react';
import type { Appointment } from '@yosemite-crew/types';
import CalculatorsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/CalculatorsPanel';
import { useCompanionStore } from '@/app/stores/companionStore';

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: jest.fn(),
}));

type Record = { type?: string; currentWeight?: number };

const mockCompanion = (record: Record | undefined, id = 'c1') => {
  (useCompanionStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: unknown) => unknown) =>
      selector({ companionsById: record ? { [id]: record } : {} })
  );
};

const appointmentFor = (id: string, name: string) =>
  ({
    companion: { id, name, species: 'Canine', parent: { id: 'p1', name: 'Owner' } },
  }) as unknown as Appointment;

const appointment = appointmentFor('c1', 'Doggy');

describe('CalculatorsPanel', () => {
  it('pre-fills weight (converted to kg) and species from the patient', () => {
    mockCompanion({ type: 'dog', currentWeight: 15 });
    render(<CalculatorsPanel appointment={appointment} />);

    expect(
      screen.getByText(/Pre-filled from Doggy: 15 lbs \(6\.8 kg\), canine/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);
  });

  it('shows no pre-fill note when the patient has no recorded weight', () => {
    mockCompanion({ type: 'cat' });
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.queryByText(/Pre-filled from/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null);
  });

  it('flags an unsupported species and omits it from the pre-fill note', () => {
    mockCompanion({ type: 'horse', currentWeight: 1000 });
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.getByText(/Pre-filled from Doggy: 1000 lbs/)).toBeInTheDocument();
    expect(screen.getByText(/Calculators support canine and feline only/)).toBeInTheDocument();
    expect(screen.getByText(/recorded as equine/)).toBeInTheDocument();
  });

  it('falls back gracefully when no companion record is loaded', () => {
    mockCompanion(undefined);
    render(<CalculatorsPanel appointment={appointment} />);

    expect(screen.queryByText(/Pre-filled from/i)).not.toBeInTheDocument();
  });

  it('does not keep the previous patient values when the patient changes', () => {
    // The panel survives a patient change (the side action is global state) and the
    // calculator form seeds its inputs from props on mount only — a stale weight here
    // would be a dosing hazard.
    mockCompanion({ type: 'dog', currentWeight: 15 });
    const { rerender } = render(<CalculatorsPanel appointment={appointment} />);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);

    mockCompanion({ type: 'dog', currentWeight: 30 }, 'c2');
    rerender(<CalculatorsPanel appointment={appointmentFor('c2', 'Rex')} />);

    expect(screen.getByText(/Pre-filled from Rex: 30 lbs \(13\.61 kg\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(13.61);
  });

  it('applies the pre-fill once the companion record hydrates', () => {
    mockCompanion(undefined);
    const { rerender } = render(<CalculatorsPanel appointment={appointment} />);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null);

    mockCompanion({ type: 'dog', currentWeight: 15 });
    rerender(<CalculatorsPanel appointment={appointment} />);

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);
  });
});
