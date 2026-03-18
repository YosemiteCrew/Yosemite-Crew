import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Reschedule from '@/app/features/appointments/pages/Appointments/Sections/Reschedule';

const useTeamForPrimaryOrgMock = jest.fn();
const getSlotsMock = jest.fn();
const updateAppointmentMock = jest.fn();
const allowRescheduleMock = jest.fn();
const notifyMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamForPrimaryOrgMock(),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  getSlotsForServiceAndDateForPrimaryOrg: (...args: any[]) => getSlotsMock(...args),
  updateAppointment: (...args: any[]) => updateAppointmentMock(...args),
}));

jest.mock('@/app/lib/date', () => ({
  buildUtcDateFromDateAndTime: (date: Date) => date,
  getDurationMinutes: () => 30,
  toUtcCalendarDate: (date: Date) => date,
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: (...args: any[]) => allowRescheduleMock(...args),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ onClose, title }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/components/DateTimePickerSection', () => ({
  __esModule: true,
  default: ({
    timeSlots,
    setSelectedSlot,
    leadOptions,
    onLeadSelect,
    leadError,
    slotError,
  }: any) => (
    <div>
      <div>{slotError}</div>
      <div>{leadError}</div>
      <button type="button" onClick={() => timeSlots[0] && setSelectedSlot(timeSlots[0])}>
        Pick slot
      </button>
      <button
        type="button"
        onClick={() => onLeadSelect(leadOptions[0] || { label: 'Dr. A', value: 'lead-1' })}
      >
        Pick lead
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('Reschedule section', () => {
  const setShowModal = jest.fn();
  const activeAppointment: any = {
    id: 'a-1',
    status: 'REQUESTED',
    appointmentDate: new Date('2026-01-01T10:00:00Z'),
    appointmentType: { id: 'service-1' },
    lead: { id: 'lead-1', name: 'Dr. A' },
    durationMinutes: 30,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTeamForPrimaryOrgMock.mockReturnValue([
      { _id: 'lead-1', practionerId: 'lead-1', name: 'Dr. A' },
      { _id: 'lead-2', practionerId: 'lead-2', name: 'Dr. B' },
    ]);
    getSlotsMock.mockResolvedValue([{ startTime: '10:00', endTime: '10:30', vetIds: ['lead-1'] }]);
    allowRescheduleMock.mockReturnValue(true);
    updateAppointmentMock.mockResolvedValue({});
  });

  it('blocks modal immediately for non-reschedulable status', async () => {
    allowRescheduleMock.mockReturnValue(false);
    render(
      <Reschedule
        showModal
        setShowModal={setShowModal}
        activeAppointment={{
          ...activeAppointment,
          status: 'COMPLETED',
          appointmentType: undefined,
        }}
      />
    );

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Reschedule blocked' })
      )
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('loads slots and submits update when valid', async () => {
    render(
      <Reschedule showModal setShowModal={setShowModal} activeAppointment={activeAppointment} />
    );

    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledWith('service-1', expect.any(Date)));
    fireEvent.click(screen.getByText('Pick slot'));
    fireEvent.click(screen.getByText('Pick lead'));
    fireEvent.click(screen.getByText('Send request'));

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalled());
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('resets state on modal header close', async () => {
    render(
      <Reschedule showModal setShowModal={setShowModal} activeAppointment={activeAppointment} />
    );
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
