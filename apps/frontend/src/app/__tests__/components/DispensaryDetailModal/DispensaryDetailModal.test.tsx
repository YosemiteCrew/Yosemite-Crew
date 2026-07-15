'use client';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children, showModal }: { children: React.ReactNode; showModal: boolean }) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/features/appointments/services/prescriptionWorkflowService', () => ({
  dispensePrescription: jest.fn(),
  notDispensedPrescription: jest.fn(),
}));

jest.mock('@/app/features/inventory/services/dispensaryService', () => ({
  fetchPrescriptionLabelPdf: jest.fn(),
}));

import DispensaryDetailModal from '@/app/features/inventory/components/DispensaryDetailModal';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';
import {
  dispensePrescription,
  notDispensedPrescription,
} from '@/app/features/appointments/services/prescriptionWorkflowService';
import { DispensaryRecord } from '@/app/features/inventory/pages/Inventory/types';

const fetchLabelMock = fetchPrescriptionLabelPdf as jest.MockedFunction<
  typeof fetchPrescriptionLabelPdf
>;
const dispenseMock = dispensePrescription as jest.MockedFunction<typeof dispensePrescription>;
const notDispensedMock = notDispensedPrescription as jest.MockedFunction<
  typeof notDispensedPrescription
>;

const baseRecord: DispensaryRecord = {
  id: 'req-1',
  prescriptionId: 'rx-abc',
  status: 'DISPENSED',
  requestType: 'PATIENT',
  patient: { name: 'Buddy', appointmentId: 'appt-1' },
  prescriptionItems: [],
  prescriptionCreated: '2026-01-01',
  amountCents: 5000,
  lead: 'Dr. Smith',
  location: 'Room A',
  items: [],
};

const defaultProps = {
  record: baseRecord,
  showModal: true,
  setShowModal: jest.fn(),
  organisationId: 'org-123',
  onActionComplete: jest.fn(),
};

describe('DispensaryDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global.URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(global.URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });
  });

  describe('Label button (dispensed state)', () => {
    it('renders the Label button when status is DISPENSED', () => {
      render(<DispensaryDetailModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /label/i })).toBeInTheDocument();
    });

    it('does not render Dispense/Not dispensed buttons when DISPENSED', () => {
      render(<DispensaryDetailModal {...defaultProps} />);
      expect(screen.queryByText(/dispense all/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/not dispensed/i)).not.toBeInTheDocument();
    });

    it('opens the label PDF in a new tab on click', async () => {
      const mockBlob = new Blob(['%PDF'], { type: 'application/pdf' });
      fetchLabelMock.mockResolvedValue(mockBlob);
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

      render(<DispensaryDetailModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /label/i }));

      await waitFor(() => {
        expect(fetchLabelMock).toHaveBeenCalledWith('org-123', 'rx-abc');
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');

      openSpy.mockRestore();
    });

    it('focuses the new window when window.open returns a window reference', async () => {
      const mockBlob = new Blob(['%PDF'], { type: 'application/pdf' });
      fetchLabelMock.mockResolvedValue(mockBlob);
      const focusMock = jest.fn();
      const openSpy = jest
        .spyOn(window, 'open')
        .mockReturnValue({ focus: focusMock } as unknown as Window);

      render(<DispensaryDetailModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /label/i }));

      await waitFor(() => {
        expect(focusMock).toHaveBeenCalled();
      });

      openSpy.mockRestore();
    });

    it('shows Loading… while fetching and re-enables after', async () => {
      let resolve: (b: Blob) => void;
      fetchLabelMock.mockReturnValue(
        new Promise((res) => {
          resolve = res;
        })
      );
      jest.spyOn(window, 'open').mockReturnValue(null);

      render(<DispensaryDetailModal {...defaultProps} />);
      const btn = screen.getByRole('button', { name: /label/i });
      fireEvent.click(btn);

      expect(await screen.findByText('Loading…')).toBeInTheDocument();
      expect(btn).toBeDisabled();

      resolve!(new Blob([], { type: 'application/pdf' }));
      await waitFor(() => expect(screen.getByText('Label')).toBeInTheDocument());
      expect(btn).not.toBeDisabled();
    });

    it('ignores a second click while already printing', async () => {
      let resolve: (b: Blob) => void;
      fetchLabelMock.mockReturnValue(
        new Promise((res) => {
          resolve = res;
        })
      );
      jest.spyOn(window, 'open').mockReturnValue(null);

      render(<DispensaryDetailModal {...defaultProps} />);
      const btn = screen.getByRole('button', { name: /label/i });
      fireEvent.click(btn);
      fireEvent.click(btn);

      resolve!(new Blob([], { type: 'application/pdf' }));
      await waitFor(() => expect(screen.getByText('Label')).toBeInTheDocument());
      expect(fetchLabelMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pending state (PENDING)', () => {
    const pendingRecord = { ...baseRecord, status: 'PENDING' as const };

    it('renders Dispense all and Not dispensed buttons', () => {
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);
      expect(screen.getByText(/dispense all/i)).toBeInTheDocument();
      expect(screen.getByText(/not dispensed/i)).toBeInTheDocument();
    });

    it('does not render the Label button', () => {
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);
      expect(screen.queryByRole('button', { name: /label/i })).not.toBeInTheDocument();
    });

    it('calls dispensePrescription on Dispense all click', async () => {
      dispenseMock.mockResolvedValue(undefined as never);
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);
      fireEvent.click(screen.getByText(/dispense all/i));
      await waitFor(() => expect(dispenseMock).toHaveBeenCalledWith('org-123', 'rx-abc'));
    });

    it('calls notDispensedPrescription on Not dispensed click', async () => {
      notDispensedMock.mockResolvedValue(undefined as never);
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);
      fireEvent.click(screen.getByText(/not dispensed/i));
      await waitFor(() => expect(notDispensedMock).toHaveBeenCalledWith('org-123', 'rx-abc'));
    });
  });

  it('does not render when showModal is false', () => {
    render(<DispensaryDetailModal {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('renders nothing when record is null', () => {
    const { container } = render(<DispensaryDetailModal {...defaultProps} record={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('Owner name derivation', () => {
    it('shows patient name with owner last name and the full owner name line when petParentName is present', () => {
      const record = { ...baseRecord, petParentName: 'Tim Cook' };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Buddy • Cook')).toBeInTheDocument();
      expect(screen.getByText('Tim Cook')).toBeInTheDocument();
    });

    it('shows just the patient name when petParentName is absent', () => {
      const record = { ...baseRecord, petParentName: undefined };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Buddy')).toBeInTheDocument();
      expect(screen.queryByText('Buddy •')).not.toBeInTheDocument();
    });
  });

  describe('Appointment ID display', () => {
    it('shows the appointment id when present and not a dash', () => {
      const record = {
        ...baseRecord,
        patient: { ...baseRecord.patient, appointmentId: 'appt-99' },
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Appointment ID')).toBeInTheDocument();
      expect(screen.getByText('appt-99')).toBeInTheDocument();
    });

    it('hides the appointment id block when it is a dash', () => {
      const record = { ...baseRecord, patient: { ...baseRecord.patient, appointmentId: '—' } };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.queryByText('Appointment ID')).not.toBeInTheDocument();
    });
  });

  describe('Items: empty state', () => {
    it('shows "No items recorded" when there are no items', () => {
      const record = { ...baseRecord, items: [] };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('No items recorded')).toBeInTheDocument();
    });

    it('shows "No items recorded" when items is undefined', () => {
      const record = { ...baseRecord, items: undefined };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('No items recorded')).toBeInTheDocument();
    });
  });

  describe('Items: badges', () => {
    it('renders Rx and Controlled badges when flagged', () => {
      const record = {
        ...baseRecord,
        items: [{ name: 'Drug A', quantity: 1, priceCents: 100, isRx: true, isControlled: true }],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Rx')).toBeInTheDocument();
      expect(screen.getByText('Controlled')).toBeInTheDocument();
    });

    it('does not render Rx or Controlled badges when not flagged', () => {
      const record = {
        ...baseRecord,
        items: [{ name: 'Drug A', quantity: 1, priceCents: 100, isRx: false, isControlled: false }],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.queryByText('Rx')).not.toBeInTheDocument();
      expect(screen.queryByText('Controlled')).not.toBeInTheDocument();
    });
  });

  describe('Items: prescription row', () => {
    it('renders frequency and refill remaining when present', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 2,
            priceCents: 100,
            frequency: 'BID (twice daily)',
            refillsRemaining: 4,
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Freq.')).toBeInTheDocument();
      expect(screen.getByText('BID (twice daily)')).toBeInTheDocument();
      expect(screen.getByText('4 remaining')).toBeInTheDocument();
    });

    it('shows a dash for refill when refillsRemaining is null', () => {
      const record = {
        ...baseRecord,
        items: [{ name: 'Drug A', quantity: 1, priceCents: 100 }],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('Freq.')).not.toBeInTheDocument();
    });

    it('renders duration with its unit when durationDays is present', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            durationDays: 2,
            durationUnit: 'weeks',
            frequencyPerDay: 3,
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('2 weeks')).toBeInTheDocument();
    });
  });

  describe('Items: dispense calculation', () => {
    it.each([
      ['SID', 1],
      ['once daily', 1],
      ['BID', 2],
      ['twice daily', 2],
      ['TID', 3],
      ['three times daily', 3],
      ['thrice daily', 3],
      ['QID', 4],
      ['four times daily', 4],
      ['every 4 hours', 6],
      ['every 6 hours', 4],
      ['Q6H', 4],
      ['every 8 hours', 3],
      ['Q8H', 3],
      ['every 12 hours', 2],
      ['Q12H', 2],
      ['once weekly', 1 / 7],
      ['weekly', 1 / 7],
      ['before meals', 3],
      ['after meals', 3],
    ])('derives the correct frequency per day from "%s"', (frequency, expectedFreq) => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequency,
            durationDays: 7,
          },
        ],
      };
      const { container } = render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Dispense qnt. calculation:')).toBeInTheDocument();
      const expectedTotal =
        expectedFreq < 1
          ? Math.ceil(1 * expectedFreq * 7)
          : Number((1 * expectedFreq * 7).toFixed(2));
      expect(
        container.querySelector('.text-caption-1.text-text-primary .font-bold')?.textContent
      ).toBe(`${expectedTotal} ${expectedTotal === 1 ? 'unit' : 'units'}`);
    });

    it('does not compute a calculation block when frequency is unrecognized and frequencyPerDay is absent', () => {
      const record = {
        ...baseRecord,
        items: [
          { name: 'Drug A', quantity: 1, priceCents: 100, frequency: 'as needed', durationDays: 7 },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.queryByText('Dispense qnt. calculation:')).not.toBeInTheDocument();
    });

    it('uses durationUnit "weeks" to compute total days', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequencyPerDay: 3,
            durationDays: 2,
            durationUnit: 'weeks',
          },
        ],
      };
      const { container } = render(<DispensaryDetailModal {...defaultProps} record={record} />);
      // 1 * 3 * (2 weeks -> 14 days) = 42
      expect(
        container.querySelector('.text-caption-1.text-text-primary .font-bold')?.textContent
      ).toBe('42 units');
    });

    it('uses durationUnit "months" to compute total days', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequencyPerDay: 1,
            durationDays: 1,
            durationUnit: 'months',
          },
        ],
      };
      const { container } = render(<DispensaryDetailModal {...defaultProps} record={record} />);
      // 1 * 1 * (1 month -> 30 days) = 30
      expect(
        container.querySelector('.text-caption-1.text-text-primary .font-bold')?.textContent
      ).toBe('30 units');
    });

    it('defaults to days when durationUnit is absent', () => {
      const record = {
        ...baseRecord,
        items: [
          { name: 'Drug A', quantity: 2, priceCents: 100, frequencyPerDay: 1, durationDays: 5 },
        ],
      };
      const { container } = render(<DispensaryDetailModal {...defaultProps} record={record} />);
      // 2 * 1 * 5 = 10
      expect(
        container.querySelector('.text-caption-1.text-text-primary .font-bold')?.textContent
      ).toBe('10 units');
    });
  });

  describe('Items: pack calculation and pluralization', () => {
    it('shows pack count and the "1 strip of N units" line when stockUnitQty is present', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequencyPerDay: 3,
            durationDays: 14,
            doseUnit: 'capsule',
            stockUnitQty: 12,
            stockUnitType: 'Strip',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      // total = 1 * 3 * 14 = 42, packs = ceil(42/12) = 4
      expect(screen.getAllByText(/4 strips/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/1 strip of 12 capsule/i)).toBeInTheDocument();
    });

    it('defaults the "of N units" line to "units" when doseUnit is absent', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequencyPerDay: 3,
            durationDays: 14,
            stockUnitQty: 12,
            stockUnitType: 'Strip',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText(/1 strip of 12 units/i)).toBeInTheDocument();
    });

    it('falls back to totalUnits display when stockUnitQty is missing', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            frequencyPerDay: 1,
            durationDays: 1,
            doseUnit: 'tablet',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('1 tablet')).toBeInTheDocument();
    });

    it('pluralizes a unit count greater than 1 by appending "s"', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 2,
            priceCents: 100,
            frequencyPerDay: 1,
            durationDays: 1,
            doseUnit: 'tablet',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('2 tablets')).toBeInTheDocument();
    });

    it('does not pluralize ml-style units', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 5,
            priceCents: 100,
            frequencyPerDay: 1,
            durationDays: 1,
            doseUnit: 'ml',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('5 ml')).toBeInTheDocument();
    });

    it('does not double-pluralize a unit that already ends in s', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 3,
            priceCents: 100,
            frequencyPerDay: 1,
            durationDays: 1,
            doseUnit: 'doses',
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('3 doses')).toBeInTheDocument();
    });

    it('defaults to "unit(s)" when no dose unit is provided', () => {
      const record = {
        ...baseRecord,
        items: [
          { name: 'Drug A', quantity: 2, priceCents: 100, frequencyPerDay: 1, durationDays: 1 },
        ],
      };
      const { container } = render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(
        container.querySelector('.text-caption-1.text-text-primary .font-bold')?.textContent
      ).toBe('2 units');
    });
  });

  describe('Items: fallback prescription display', () => {
    it('renders legacy prescription fields when no enriched frequency/duration is present', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            prescription: { dose: '1 tab', freq: 'Once daily', duration: '5 days', refill: '2' },
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.getByText('Once daily')).toBeInTheDocument();
      expect(screen.getByText('5 days')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('omits fallback freq/duration/refill spans when their values are empty', () => {
      const record = {
        ...baseRecord,
        items: [
          {
            name: 'Drug A',
            quantity: 1,
            priceCents: 100,
            prescription: { dose: '', freq: '', duration: '', refill: '' },
          },
        ],
      };
      render(<DispensaryDetailModal {...defaultProps} record={record} />);
      expect(screen.queryByText('Once daily')).not.toBeInTheDocument();
    });
  });

  describe('Action button guards', () => {
    it('ignores a second Dispense all click while already actioning', async () => {
      let resolve: () => void;
      dispenseMock.mockReturnValue(
        new Promise((res) => {
          resolve = () => res(undefined as never);
        })
      );
      const pendingRecord = { ...baseRecord, status: 'PENDING' as const };
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);

      fireEvent.click(screen.getByText(/dispense all/i));
      fireEvent.click(screen.getByText(/dispensing/i));

      resolve!();
      await waitFor(() => expect(dispenseMock).toHaveBeenCalledTimes(1));
    });

    it('ignores a second Not dispensed click while already actioning', async () => {
      let resolve: () => void;
      notDispensedMock.mockReturnValue(
        new Promise((res) => {
          resolve = () => res(undefined as never);
        })
      );
      const pendingRecord = { ...baseRecord, status: 'PENDING' as const };
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);

      fireEvent.click(screen.getByText(/not dispensed/i));
      fireEvent.click(screen.getByText(/not dispensed/i));

      resolve!();
      await waitFor(() => expect(notDispensedMock).toHaveBeenCalledTimes(1));
    });

    it('disables the close button while actioning', async () => {
      let resolve: () => void;
      dispenseMock.mockReturnValue(
        new Promise((res) => {
          resolve = () => res(undefined as never);
        })
      );
      const pendingRecord = { ...baseRecord, status: 'PENDING' as const };
      render(<DispensaryDetailModal {...defaultProps} record={pendingRecord} />);

      fireEvent.click(screen.getByText(/dispense all/i));
      expect(screen.getByLabelText('Close')).toBeDisabled();

      resolve!();
      await waitFor(() => expect(screen.getByLabelText('Close')).not.toBeDisabled());
    });
  });
});
