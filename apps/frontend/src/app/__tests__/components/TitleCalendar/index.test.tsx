import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

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
        activeCalendar="day"
        title="Appointments"
        description="Daily schedule"
        setActiveCalendar={jest.fn()}
        setAddPopup={setAddPopup}
        currentDate={new Date('2025-01-06T00:00:00Z')}
        setCurrentDate={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={jest.fn()}
        showAdd
      />
    );

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByText('Daily schedule')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add'));
    expect(setAddPopup).toHaveBeenCalledWith(true);
  });

  it('toggles active view', () => {
    const setActiveView = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Appointments"
        setActiveCalendar={jest.fn()}
        setAddPopup={jest.fn()}
        currentDate={new Date('2025-01-06T00:00:00Z')}
        setCurrentDate={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={setActiveView}
        showAdd={false}
      />
    );

    const viewButtons = screen.getAllByRole('button');
    fireEvent.click(viewButtons[0]);
    fireEvent.click(viewButtons[1]);
    fireEvent.click(viewButtons[2]);

    expect(setActiveView).toHaveBeenCalledWith('calendar');
    expect(setActiveView).toHaveBeenCalledWith('board');
    expect(setActiveView).toHaveBeenCalledWith('list');
  });

  it('renders only configured view options', () => {
    const setActiveView = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Tasks"
        setActiveCalendar={jest.fn()}
        setAddPopup={jest.fn()}
        currentDate={new Date('2025-01-06T00:00:00Z')}
        setCurrentDate={jest.fn()}
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
