import React from 'react';
import { render } from '@testing-library/react';
import { buildAppointmentColumns, normalizeLeadId } from '@/app/ui/tables/appointmentsTableColumns';
import type { Appointment } from '@yosemite-crew/types';

const args = {
  encountersById: {},
  roomUnitsById: {},
  leadNameByPractitionerId: {},
  orgsById: {},
  invoicesByAppointmentId: {},
  canEditAppointments: true,
  getSoapViewIntent: jest.fn(),
  onViewAppointmentHistory: jest.fn(),
  onViewAppointment: jest.fn(),
  onChangeStatusAppointment: jest.fn(),
  onCancelAppointment: jest.fn(),
  onRescheduleAppointment: jest.fn(),
  onChangeRoomAppointment: jest.fn(),
  onWorkspaceAppointment: jest.fn(),
} as unknown as Parameters<typeof buildAppointmentColumns>[0];

const appointment = (over: Partial<Appointment> = {}): Appointment =>
  ({
    _id: 'apt-1',
    isEmergency: false,
    companion: { name: 'Lily', parent: { firstName: 'Marshal', lastName: 'Mathers' } },
    ...over,
  }) as unknown as Appointment;

const renderNameCell = (item: Appointment) => {
  const columns = buildAppointmentColumns(args);
  const nameColumn = columns.find((c) => c.label === 'Name');
  if (!nameColumn?.render) throw new Error('Name column has no render');
  return render(<div>{nameColumn.render(item)}</div>);
};

describe('appointmentsTableColumns', () => {
  describe('normalizeLeadId', () => {
    it('returns an empty string for nullish input', () => {
      expect(normalizeLeadId(null)).toBe('');
      expect(normalizeLeadId(undefined)).toBe('');
    });

    it('trims a provided id', () => {
      expect(normalizeLeadId('  abc  ')).toBe('abc');
    });
  });

  describe('name cell', () => {
    // The column is 140px and the Emergency chip takes half of it. Without a
    // clamp, `.appointment-profile-title`'s `overflow-wrap: anywhere` broke the
    // name mid-WORD - "Lily · Mathers" rendered as "Mather" / "s" over three
    // lines. That rule is declared unlayered so Tailwind's `truncate` loses to
    // it; the clamp has to be `cell-truncate`, which is declared alongside it.
    it('clamps the name rather than letting it break mid-word', () => {
      const { container } = renderNameCell(appointment());
      const name = container.querySelector('.appointment-profile-title.cell-name');

      expect(name).toBeInTheDocument();
      expect(name).toHaveClass('cell-truncate');
      expect(name).toHaveClass('min-w-0');
    });

    it('keeps the emergency chip at its own size so it cannot squeeze the name', () => {
      const { container, getByText } = renderNameCell(appointment({ isEmergency: true }));

      expect(getByText('Emergency')).toHaveClass('shrink-0');
      // The flex row itself must be shrinkable or min-w-0 on the child does nothing.
      expect(container.querySelector('.flex.min-w-0.items-center')).toBeInTheDocument();
    });

    it('exposes the full name as a title, since the visible text may be clipped', () => {
      const { container } = renderNameCell(appointment());
      const name = container.querySelector('.appointment-profile-title.cell-name');

      expect(name?.getAttribute('title')).toContain('Lily');
      expect(name?.getAttribute('title')).not.toBe('Open appointment overview');
    });

    it('renders no emergency chip on an ordinary appointment', () => {
      const { queryByText } = renderNameCell(appointment());
      expect(queryByText('Emergency')).not.toBeInTheDocument();
    });
  });
});
