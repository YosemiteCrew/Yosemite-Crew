import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OutpatientSchedule from '@/app/features/appointments/pages/AppointmentWorkspace/components/OutpatientSchedule';
import type {
  OutpatientScheduleModel,
  OutpatientVisit,
} from '@/app/features/appointments/lib/outpatientSchedule';

const visit = (over: Partial<OutpatientVisit>): OutpatientVisit => ({
  id: 'v',
  title: 'Recheck',
  startTime: '2026-07-14T09:00:00.000Z',
  durationMinutes: 20,
  leadName: 'Dr. Sarah Weber',
  roomName: 'Room 1',
  status: 'SCHEDULED',
  group: 'THIS_WEEK',
  ...over,
});

const model = (over: Partial<OutpatientScheduleModel> = {}): OutpatientScheduleModel => ({
  thisWeek: [],
  nextWeek: [],
  total: 0,
  proposedCount: 0,
  ...over,
});

describe('OutpatientSchedule', () => {
  it('renders the empty state when there are no visits', () => {
    render(<OutpatientSchedule schedule={model()} />);
    expect(screen.getByText('No scheduled visits for this companion.')).toBeInTheDocument();
    expect(screen.getByText('Scheduled outpatient visits · 0')).toBeInTheDocument();
  });

  it('renders this-week and next-week groups with visit detail', () => {
    const thisWeek = [visit({ id: 'a', title: 'Laser therapy' })];
    const nextWeek = [
      visit({
        id: 'b',
        title: 'Recheck ear',
        group: 'NEXT_WEEK',
        status: 'PROPOSED',
        startTime: '2026-07-21T10:30:00.000Z',
      }),
    ];
    render(
      <OutpatientSchedule schedule={model({ thisWeek, nextWeek, total: 2, proposedCount: 1 })} />
    );
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('Next week')).toBeInTheDocument();
    expect(screen.getByText('Laser therapy')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Proposed')).toBeInTheDocument();
    expect(screen.getByText('1 proposed visit awaiting owner confirmation')).toBeInTheDocument();
  });

  it('pluralises the proposed footer', () => {
    render(
      <OutpatientSchedule
        schedule={model({
          nextWeek: [
            visit({ id: 'p1', status: 'PROPOSED', group: 'NEXT_WEEK' }),
            visit({ id: 'p2', status: 'PROPOSED', group: 'NEXT_WEEK' }),
          ],
          total: 2,
          proposedCount: 2,
        })}
      />
    );
    expect(screen.getByText('2 proposed visits awaiting owner confirmation')).toBeInTheDocument();
  });

  it('fires the add-visit action when provided', () => {
    const onAddVisit = jest.fn();
    render(
      <OutpatientSchedule
        schedule={model({ thisWeek: [visit({})], total: 1 })}
        onAddVisit={onAddVisit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Add visit/ }));
    expect(onAddVisit).toHaveBeenCalledTimes(1);
  });

  it('disables add-visit when read only and omits it when no handler is given', () => {
    const { rerender } = render(
      <OutpatientSchedule
        schedule={model({ thisWeek: [visit({})], total: 1 })}
        onAddVisit={jest.fn()}
        readOnly
      />
    );
    expect(screen.getByRole('button', { name: /Add visit/ })).toBeDisabled();
    rerender(<OutpatientSchedule schedule={model({ thisWeek: [visit({})], total: 1 })} />);
    expect(screen.queryByRole('button', { name: /Add visit/ })).not.toBeInTheDocument();
  });

  it('renders a placeholder marker for an unparseable start', () => {
    render(
      <OutpatientSchedule
        schedule={model({
          thisWeek: [visit({ id: 'z', startTime: 'not-a-date', durationMinutes: undefined })],
          total: 1,
        })}
      />
    );
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });
});
