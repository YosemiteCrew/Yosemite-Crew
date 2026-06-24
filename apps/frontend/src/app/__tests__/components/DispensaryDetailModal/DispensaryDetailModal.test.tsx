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
});
