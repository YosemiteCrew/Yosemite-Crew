import React from 'react';
import { render, screen } from '@testing-library/react';
import ZoomOutMarker from '@/app/features/appointments/components/Calendar/common/ZoomOutMarker';
import { Appointment } from '@yosemite-crew/types';

jest.mock('@/app/config/statusConfig', () => ({
  getStatusStyle: jest.fn(() => ({
    backgroundColor: '#eef6ff',
    color: '#123456',
    borderColor: '#89a',
  })),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/slotHelpers', () => ({
  getCompanionDisplayName: jest.fn(() => 'Maple Rivera'),
  setCustomDragGhost: jest.fn(),
}));

const baseEvent = {
  id: 'apt-1',
  status: 'Scheduled',
  appointmentType: { name: 'Wellness' },
  concern: 'Vaccines',
  companion: { name: 'Maple', species: 'Dog' },
  patient: { name: 'Maple', species: 'Dog' },
} as unknown as Appointment;

const defaultProps = {
  ev: baseEvent,
  marginTopPx: 0,
  itemKey: 'zoomout-apt-1',
  activePopoverKey: null,
  appointmentPopoverId: 'popover-1',
  draggedAppointmentId: null,
  onMarkerClick: jest.fn(),
  onMarkerDoubleClick: jest.fn(),
  onMarkerContextMenu: jest.fn(),
  onDropPreviewClear: jest.fn(),
};

describe('ZoomOutMarker', () => {
  it('shows a truncated visible label once the block is tall enough for one line (bug #1942)', () => {
    render(<ZoomOutMarker {...defaultProps} blockHeightPx={16} />);

    const label = screen.getByText('Maple Rivera • Wellness • Vaccines');
    expect(label).not.toHaveClass('sr-only');
    expect(label).toHaveClass('truncate');
  });

  it('falls back to an accessible-only label when the block is too short for any text', () => {
    render(<ZoomOutMarker {...defaultProps} blockHeightPx={15} />);

    const label = screen.getByText('Maple Rivera • Wellness • Vaccines');
    expect(label).toHaveClass('sr-only');
  });
});
