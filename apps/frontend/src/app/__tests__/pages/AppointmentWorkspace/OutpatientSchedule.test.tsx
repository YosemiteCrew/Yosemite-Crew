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
    expect(screen.getByText('No scheduled tasks for this companion.')).toBeInTheDocument();
    expect(screen.getByText('Scheduled outpatient tasks · 0')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Add task/ }));
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
    expect(screen.getByRole('button', { name: /Add task/ })).toBeDisabled();
    rerender(<OutpatientSchedule schedule={model({ thisWeek: [visit({})], total: 1 })} />);
    expect(screen.queryByRole('button', { name: /Add task/ })).not.toBeInTheDocument();
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

  // The series elements are pass-throughs of backend fields nothing populates yet,
  // so each one must be entirely absent until its data is genuinely present.
  describe('series signals', () => {
    it('appends the session position to a visit title when index and total are both known', () => {
      render(
        <OutpatientSchedule
          schedule={model({
            thisWeek: [visit({ id: 'a', title: 'Laser therapy', seriesIndex: 2, seriesTotal: 6 })],
            total: 1,
          })}
        />
      );
      expect(screen.getByText('Laser therapy · session 2 of 6')).toBeInTheDocument();
    });

    it('shows the plain title when only one half of the position is known', () => {
      render(
        <OutpatientSchedule
          schedule={model({
            thisWeek: [visit({ id: 'a', title: 'Laser therapy', seriesTotal: 6 })],
            total: 1,
          })}
        />
      );
      expect(screen.getByText('Laser therapy')).toBeInTheDocument();
      expect(screen.queryByText(/session/)).not.toBeInTheDocument();
    });

    it('renders the series note and progress rail when the schedule carries them', () => {
      render(
        <OutpatientSchedule
          schedule={model({
            thisWeek: [visit({ id: 'a' })],
            total: 1,
            seriesNote: 'Laser series booked as a package.',
            seriesProgress: { completed: 1, total: 6 },
          })}
        />
      );
      expect(screen.getByText('Series note')).toBeInTheDocument();
      expect(screen.getByText('Laser series booked as a package.')).toBeInTheDocument();
      expect(screen.getByText('1 / 6 done')).toBeInTheDocument();

      // The rail is a native <progress>: the engine derives the fill from value/max,
      // so those carry both the accessible value semantics and the visual ratio.
      const rail = screen.getByRole('progressbar', { name: 'Series progress' });
      expect(rail.tagName).toBe('PROGRESS');
      expect(rail).toHaveAttribute('value', '1');
      expect(rail).toHaveAttribute('max', '6');
      expect((rail as HTMLProgressElement).value).toBe(1);
      expect((rail as HTMLProgressElement).max).toBe(6);
    });

    it('renders neither the note nor the progress rail when the schedule has no series', () => {
      render(<OutpatientSchedule schedule={model({ thisWeek: [visit({})], total: 1 })} />);
      expect(screen.queryByText('Series note')).not.toBeInTheDocument();
      expect(screen.queryByText('Series progress')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
