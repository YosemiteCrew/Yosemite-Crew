import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

import TitleCalendar from '@/app/ui/widgets/TitleCalendar';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: () => <div data-testid="datepicker" />,
}));

describe('TitleCalendar', () => {
  it('renders title, count, and add button', () => {
    const setAddPopup = jest.fn();

    render(
      <TitleCalendar
        title="Appointments"
        description="Daily schedule"
        setAddPopup={setAddPopup}
        count={3}
        activeView="calendar"
        setActiveView={jest.fn()}
        showAdd
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /Appointments/ })).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByText('Daily schedule')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add'));
    expect(setAddPopup).toHaveBeenCalledWith(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <TitleCalendar
        title="Appointments"
        description="Daily schedule"
        setAddPopup={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={jest.fn()}
        showAdd
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('toggles active view', () => {
    const setActiveView = jest.fn();

    render(
      <TitleCalendar
        title="Appointments"
        setAddPopup={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={setActiveView}
        showAdd={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();

    const viewButtons = screen.getAllByRole('button');
    fireEvent.click(viewButtons[0]);
    fireEvent.click(viewButtons[1]);
    fireEvent.click(viewButtons[2]);

    expect(setActiveView).toHaveBeenCalledWith('calendar');
    expect(setActiveView).toHaveBeenCalledWith('board');
    expect(setActiveView).toHaveBeenCalledWith('list');
  });

  it('falls back to the default width for a single view option', () => {
    const setActiveView = jest.fn();
    render(
      <TitleCalendar
        title="One"
        setAddPopup={jest.fn()}
        count={1}
        activeView="calendar"
        setActiveView={setActiveView}
        showAdd={false}
        viewOptions={['calendar']}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders only configured view options', () => {
    const setActiveView = jest.fn();

    render(
      <TitleCalendar
        title="Tasks"
        setAddPopup={jest.fn()}
        count={2}
        activeView="calendar"
        setActiveView={setActiveView}
        showAdd={false}
        viewOptions={['calendar', 'list']}
      />
    );

    const viewButtons = screen.getAllByRole('button');
    expect(viewButtons).toHaveLength(2);
    fireEvent.click(viewButtons[0]);
    fireEvent.click(viewButtons[1]);

    expect(setActiveView).toHaveBeenCalledWith('calendar');
    expect(setActiveView).toHaveBeenCalledWith('list');
    expect(setActiveView).not.toHaveBeenCalledWith('board');
  });
});
