import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrescriptionEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/PrescriptionEditor';
import {
  authoriseFills,
  getFillEligibility,
} from '@/app/features/appointments/services/prescriptionFillAuthorisationService';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/features/appointments/services/clinicalTermsService', () => ({
  suggestMedications: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/app/features/appointments/services/prescriptionFillAuthorisationService', () => ({
  authoriseFills: jest.fn(),
  getFillEligibility: jest.fn(),
}));

const eligibility = {
  authorizationId: 'authority-1',
  version: 1,
  eligible: true,
  reasonCodes: [],
  remainingFills: 3,
  remainingQuantity: '15',
  unit: 'tablet',
  expiresAt: '2027-01-01T00:00:00.000Z',
};

const renderEditor = (itemOverrides: Partial<PrescriptionItem> = {}) => {
  const onUpdateItem = jest.fn();
  const initialItem: PrescriptionItem = {
    id: 'artifact-1',
    prescriptionItemId: 'line-1',
    medicineName: 'Medication',
    refill: '2',
    qty: '5',
    doseUnit: 'tablet',
    fulfillment: 'IN_HOUSE' as const,
    ...itemOverrides,
  };
  const Harness = () => {
    const [items, setItems] = React.useState<PrescriptionItem[]>([initialItem]);
    return (
      <PrescriptionEditor
        organisationId="clinic-1"
        currency="USD"
        items={items}
        catalogItems={[]}
        templateItems={[]}
        readOnly={false}
        onAddItem={jest.fn()}
        onUpdateItem={(id, patch) => {
          onUpdateItem(id, patch);
          setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, ...patch } : item))
          );
        }}
        onRemoveItem={jest.fn()}
        onPrint={jest.fn()}
      />
    );
  };
  render(<Harness />);
  return onUpdateItem;
};

describe('PrescriptionEditor refill authorisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFillEligibility as jest.Mock).mockResolvedValue(eligibility);
    (authoriseFills as jest.Mock).mockResolvedValue({ id: 'authority-1', version: 1 });
  });

  it('shows authoritative remaining fills and submits the entered expiry and prescription terms', async () => {
    renderEditor();
    expect(await screen.findByText('3 authorised fills remaining')).toBeInTheDocument();
    const expiry = screen.getByLabelText('Authorisation expires');
    expect((expiry as HTMLInputElement).value).toMatch(/^2027-01-01T/);
    fireEvent.change(expiry, { target: { value: '2027-04-02T15:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Authorise refills' }));

    await waitFor(() =>
      expect(authoriseFills).toHaveBeenCalledWith('clinic-1', 'line-1', {
        validUntil: new Date('2027-04-02T15:30').toISOString(),
        maxAdditionalFills: 2,
        perFillQuantity: '5',
        perFillQuantityUnit: 'tablet',
      })
    );
    expect(getFillEligibility).toHaveBeenCalledWith('clinic-1', 'line-1');
  });

  it('stores expiry on a draft line so the treatment save can authorise it before finalising', () => {
    const onUpdateItem = renderEditor({ prescriptionItemId: undefined });
    fireEvent.change(screen.getByLabelText('Authorisation expires'), {
      target: { value: '2027-04-02T15:30' },
    });
    expect(onUpdateItem).toHaveBeenCalledWith('artifact-1', {
      refillValidUntil: '2027-04-02T15:30',
    });
    expect(
      screen.getByText('Saving with an expiry will authorise the entered refills.')
    ).toBeInTheDocument();
  });

  it('does not allow authorisation without a dispense unit', async () => {
    renderEditor({ doseUnit: undefined, dosageForm: undefined });
    await screen.findByText('3 authorised fills remaining');
    fireEvent.change(screen.getByLabelText('Authorisation expires'), {
      target: { value: '2027-04-02T15:30' },
    });
    expect(screen.getByRole('button', { name: 'Authorise refills' })).toBeDisabled();
  });

  it('replaces the loading status with an error when eligibility cannot be read', async () => {
    (getFillEligibility as jest.Mock).mockRejectedValue(new Error('offline'));
    renderEditor();

    expect(await screen.findByText('Refill status unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load refill authorisation.');
    expect(screen.queryByText('Loading refill status…')).not.toBeInTheDocument();
  });

  it('reports an authorisation write failure without losing the entered expiry', async () => {
    (authoriseFills as jest.Mock).mockRejectedValue(new Error('forbidden'));
    renderEditor();
    await screen.findByText('3 authorised fills remaining');
    const expiry = screen.getByLabelText('Authorisation expires');
    fireEvent.change(expiry, { target: { value: '2027-04-02T15:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Authorise refills' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to authorise refills. Check your access and try again.'
    );
    expect((expiry as HTMLInputElement).value).toBe('2027-04-02T15:30');
  });
});
