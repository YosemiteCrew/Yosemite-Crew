import {
  getAllDayAppointmentAriaLabel,
  getCompanionDisplayName,
  getEventKey,
  setCustomDragGhost,
} from '@/app/features/appointments/components/Calendar/common/dayCalendarHelpers';
import { Appointment } from '@yosemite-crew/types';

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: jest.fn((name: string, parent?: { lastName?: string }) =>
    parent?.lastName ? `${name} ${parent.lastName}` : name
  ),
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanionPhotoUrl: jest.fn(() => 'https://cdn.example.com/pet.png'),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn((url: string, type: string) => `${url}?type=${type}`),
}));

const makeAppointment = (overrides: Partial<Appointment> = {}) =>
  ({
    id: 'apt-1',
    concern: 'Annual checkup',
    startTime: new Date('2026-01-02T10:00:00.000Z'),
    companion: {
      name: 'Maple',
      species: 'Dog',
      parent: { lastName: 'Rivera' },
    },
    patient: {
      name: 'Fallback',
      species: 'Cat',
      parent: { lastName: 'Stone' },
    },
    ...overrides,
  }) as Appointment;

describe('dayCalendarHelpers', () => {
  it('formats companion display names from companion data first', () => {
    expect(getCompanionDisplayName(makeAppointment())).toBe('Maple Rivera');
  });

  it('falls back to patient data when companion is missing', () => {
    expect(getCompanionDisplayName(makeAppointment({ companion: undefined }))).toBe(
      'Fallback Stone'
    );
  });

  it('builds all-day aria labels with and without concern copy', () => {
    expect(getAllDayAppointmentAriaLabel(makeAppointment())).toBe(
      'All-day appointment for Maple Rivera. Annual checkup'
    );
    expect(getAllDayAppointmentAriaLabel(makeAppointment({ concern: '' }))).toBe(
      'All-day appointment for Maple Rivera'
    );
  });

  it('builds stable event keys from source, companion, start time, and index', () => {
    expect(getEventKey(makeAppointment(), 3, 'timed')).toBe(
      'timed-Maple-2026-01-02T10:00:00.000Z-3'
    );
    expect(getEventKey(makeAppointment({ companion: undefined }), 1, 'all-day')).toBe(
      'all-day-Fallback-2026-01-02T10:00:00.000Z-1'
    );
  });

  it('sets a custom drag ghost and removes it on the next tick', () => {
    jest.useFakeTimers();
    const setDragImage = jest.fn();
    const event = {
      dataTransfer: { setDragImage },
    } as unknown as React.DragEvent<HTMLButtonElement>;

    setCustomDragGhost(event, makeAppointment());

    const ghost = document.body.querySelector('img');
    expect(ghost).not.toBeNull();
    expect(ghost).toHaveAttribute('src', 'https://cdn.example.com/pet.png?type=dog');
    expect(ghost).toHaveStyle({
      position: 'fixed',
      width: '24px',
      height: '24px',
      borderRadius: '999px',
    });
    expect(setDragImage).toHaveBeenCalledWith(ghost, 12, 12);

    jest.runOnlyPendingTimers();
    expect(document.body.querySelector('img')).toBeNull();
    jest.useRealTimers();
  });
});
