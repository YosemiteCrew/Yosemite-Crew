import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Filters from '@/app/ui/filters/Filters';

const filterOptions = [
  { key: 'all', name: 'All' },
  { key: 'recent', name: 'Recent' },
];

const statusOptions = [
  { key: 'available', name: 'Available', bg: '#eee', text: '#111' },
  { key: 'requested', name: 'Requested', bg: '#ddd', text: '#222' },
];

describe('Filters', () => {
  it('renders filter and status buttons and handles clicks', () => {
    const setActiveFilter = jest.fn();
    const setActiveStatus = jest.fn();

    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="requested"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
      />
    );

    fireEvent.click(screen.getByText('Recent'));
    expect(setActiveFilter).toHaveBeenCalledWith('recent');

    fireEvent.click(screen.getByRole('button', { name: 'Requested' }));
    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    expect(setActiveStatus).toHaveBeenCalledWith('available');
  });

  it('renders filter pills with no active filter selected', () => {
    render(<Filters filterOptions={filterOptions} setActiveFilter={jest.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('toggles an active filter back to "all" when clicked again', () => {
    const setActiveFilter = jest.fn();
    render(
      <Filters
        filterOptions={filterOptions}
        activeFilter="recent"
        setActiveFilter={setActiveFilter}
      />
    );

    fireEvent.click(screen.getByText('Recent'));
    expect(setActiveFilter).toHaveBeenCalledWith('all');
  });

  it('falls back to the first status option when the active status matches none', () => {
    render(
      <Filters
        statusOptions={statusOptions}
        activeStatus="does-not-exist"
        setActiveStatus={jest.fn()}
      />
    );

    // selectedStatus falls back to statusOptions[0] ("Available").
    expect(screen.getByRole('button', { name: 'Available' })).toBeInTheDocument();
  });

  it('keeps the status dropdown open when interacting inside the panel', () => {
    render(
      <Filters statusOptions={statusOptions} activeStatus="available" setActiveStatus={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    const option = screen.getByRole('button', { name: 'Requested' });
    fireEvent.mouseDown(option);
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
  });

  it('renders add appointment button next to filters when enabled', () => {
    const onAddButtonClick = jest.fn();

    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="requested"
        setActiveFilter={jest.fn()}
        setActiveStatus={jest.fn()}
        showAddButton
        onAddButtonClick={onAddButtonClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Appointment' }));
    expect(onAddButtonClick).toHaveBeenCalledTimes(1);
  });

  it('renders the emergency pill with a presence dot when emergencies are active', () => {
    render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'emergencies', name: 'Emergencies' },
        ]}
        activeFilter="emergencies"
        setActiveFilter={jest.fn()}
        hasEmergency
      />
    );

    expect(screen.getByText('Emergencies')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency appointments present')).toBeInTheDocument();
  });

  it('renders an inactive emergency pill without a presence dot', () => {
    render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'emergencies', name: 'Emergencies' },
        ]}
        activeFilter="all"
        setActiveFilter={jest.fn()}
      />
    );

    expect(screen.getByText('Emergencies')).toBeInTheDocument();
    expect(screen.queryByLabelText('Emergency appointments present')).not.toBeInTheDocument();
  });

  it('renders compact pills and ignores clicks when no setActiveFilter is supplied', () => {
    render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'recent', name: 'Recent' },
        ]}
        activeFilter="all"
        compactFilterPills
      />
    );

    // No handler wired up: click is a no-op and must not throw.
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('falls back to default colours for a status pill defined only by its border', () => {
    render(
      <Filters
        statusOptions={[{ key: 'flagged', name: 'Flagged', border: '#f00' }]}
        activeStatus="flagged"
        setActiveStatus={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flagged' }));
    expect(screen.getAllByText('Flagged').length).toBeGreaterThan(0);
  });

  it('applies the default text colour for a coloured status pill that omits its text token', () => {
    render(
      <Filters
        statusOptions={[{ key: 'busy', name: 'Busy', bg: '#eee', border: '#000' }]}
        activeStatus="busy"
        setActiveStatus={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Busy' })).toBeInTheDocument();
  });

  it('shows the neutral "Status" trigger when the active status has no colour tokens', () => {
    render(
      <Filters
        statusOptions={[
          { key: 'all', name: 'All' },
          { key: 'open', name: 'Open' },
        ]}
        activeStatus="all"
        setActiveStatus={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('closes the status dropdown when clicking outside of it', () => {
    render(
      <Filters statusOptions={statusOptions} activeStatus="available" setActiveStatus={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    expect(screen.getAllByText('Requested').length).toBeGreaterThan(0);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Requested')).not.toBeInTheDocument();
  });

  it('uses readable dropdown text when status pills use light text tokens', () => {
    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={[
          {
            key: 'pending',
            name: 'Pending',
            bg: 'var(--color-badge-slate-bg)',
            text: 'var(--color-badge-light-text)',
            dropdownText: 'var(--color-badge-slate-bg)',
          },
        ]}
        activeFilter="all"
        activeStatus="pending"
        setActiveFilter={jest.fn()}
        setActiveStatus={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(screen.getAllByText('Pending')[1]).toHaveStyle({
      color: 'var(--color-badge-slate-bg)',
    });
  });
});
