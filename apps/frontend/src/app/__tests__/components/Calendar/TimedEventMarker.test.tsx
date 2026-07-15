import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TimedEventMarker from '@/app/features/appointments/components/Calendar/common/TimedEventMarker';
import { LaidOutEvent } from '@/app/features/appointments/types/calendar';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    alt,
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) =>
    React.createElement('img', { alt: alt ?? '', ...props }),
}));

jest.mock('@/app/config/statusConfig', () => ({
  getStatusStyle: jest.fn(() => ({
    backgroundColor: '#eef6ff',
    color: '#123456',
    borderColor: '#89a',
  })),
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanionPhotoUrl: jest.fn(() => 'https://cdn.example.com/pet.png'),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn((url: string) => url),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/dayCalendarHelpers', () => ({
  getCompanionDisplayName: jest.fn(() => 'Maple Rivera'),
  setCustomDragGhost: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/slotHelpers', () => ({
  getCompanionDisplayName: jest.fn(() => 'Maple Rivera'),
  setCustomDragGhost: jest.fn(),
}));

const baseEvent = {
  id: 'apt-1',
  status: 'Scheduled',
  topPx: 20,
  heightPx: 80,
  columnsCount: 2,
  columnIndex: 1,
  appointmentType: { name: ' Wellness ' },
  concern: ' Vaccines ',
  companion: { name: 'Maple', species: 'Dog' },
  patient: { name: 'Maple', species: 'Dog' },
} as unknown as LaidOutEvent;

const defaultProps = {
  ev: baseEvent,
  itemKey: 'timed-apt-1',
  yScale: 1,
  zoomMode: 'in' as const,
  activePopoverKey: null,
  appointmentPopoverId: 'popover-1',
  draggedAppointmentId: null,
  onMarkerClick: jest.fn(),
  onMarkerDoubleClick: jest.fn(),
  onMarkerContextMenu: jest.fn(),
  onAppointmentDragStart: jest.fn(),
  onAppointmentDragEnd: jest.fn(),
  onDropPreviewClear: jest.fn(),
};

describe('TimedEventMarker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.cursor = '';
  });

  it('renders expanded timed appointment details and marker interactions', () => {
    render(<TimedEventMarker {...defaultProps} activePopoverKey="timed-apt-1" />);

    const marker = screen.getByRole('button', { name: /Maple Rivera Wellness . Vaccines/ });
    expect(marker).toHaveAttribute('aria-expanded', 'true');
    expect(marker).toHaveAttribute('title', 'Maple Rivera • Wellness • Vaccines');
    expect(screen.getByText('Maple Rivera')).toBeInTheDocument();
    expect(screen.getByText('Wellness • Vaccines')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/pet.png');

    fireEvent.click(marker);
    fireEvent.doubleClick(marker);
    fireEvent.contextMenu(marker);

    expect(defaultProps.onMarkerClick).toHaveBeenCalledWith(expect.any(Object), 'timed-apt-1');
    expect(defaultProps.onMarkerDoubleClick).toHaveBeenCalledWith(baseEvent);
    expect(defaultProps.onMarkerContextMenu).toHaveBeenCalledWith(expect.any(Object), baseEvent);
  });

  it('renders compact zoom-out markers with a screen-reader label', () => {
    render(
      <TimedEventMarker
        {...defaultProps}
        zoomMode="out"
        ev={{ ...baseEvent, appointmentType: { name: ' ' }, concern: ' ' } as LaidOutEvent}
      />
    );

    expect(screen.getByRole('button', { name: 'Maple Rivera' })).toBeInTheDocument();
    expect(screen.queryByText('Wellness • Vaccines')).not.toBeInTheDocument();
  });

  it('sets draggable state, drag payload, cursor cleanup, and optional callbacks', () => {
    const dataTransfer = {
      effectAllowed: '',
      setData: jest.fn(),
    };
    render(<TimedEventMarker {...defaultProps} canDragAppointment={() => true} />);

    const marker = screen.getByRole('button', { name: /Maple Rivera Wellness . Vaccines/ });
    fireEvent.dragStart(marker, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'apt-1');
    expect(document.body.style.cursor).toBe('grabbing');
    expect(defaultProps.onAppointmentDragStart).toHaveBeenCalledWith(baseEvent);

    fireEvent.dragEnd(marker);
    expect(defaultProps.onDropPreviewClear).toHaveBeenCalledTimes(1);
    expect(document.body.style.cursor).toBe('');
    expect(defaultProps.onAppointmentDragEnd).toHaveBeenCalledTimes(1);
  });

  it('uses the item key for drag payloads when the appointment id is missing', () => {
    const dataTransfer = {
      effectAllowed: '',
      setData: jest.fn(),
    };
    render(
      <TimedEventMarker
        {...defaultProps}
        ev={{ ...baseEvent, id: undefined } as LaidOutEvent}
        canDragAppointment={() => true}
        onAppointmentDragStart={undefined}
        onAppointmentDragEnd={undefined}
      />
    );

    fireEvent.dragStart(screen.getByRole('button', { name: /Maple Rivera Wellness . Vaccines/ }), {
      dataTransfer,
    });

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'timed-apt-1');
  });
});
