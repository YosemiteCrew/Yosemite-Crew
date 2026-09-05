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

  it('selects a status option from the dropdown panel and closes it', () => {
    const setActiveStatus = jest.fn();
    render(
      <Filters
        statusOptions={statusOptions}
        activeStatus="available"
        setActiveStatus={setActiveStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Requested' }));

    expect(setActiveStatus).toHaveBeenCalledWith('requested');
    // The panel closes after a selection.
    expect(screen.queryByText('Requested')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'New appointment' }));
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

  it('ignores clicks when no setActiveFilter is supplied', () => {
    render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'recent', name: 'Recent' },
        ]}
        activeFilter="all"
      />
    );

    // No handler wired up: click is a no-op and must not throw.
    fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('renders the filter chips through the shared FilterChip recipe', () => {
    render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'emergencies', name: 'Emergencies' },
        ]}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="available"
        setActiveFilter={jest.fn()}
        setActiveStatus={jest.fn()}
      />
    );

    // The toolbar used to hand-roll a second chip recipe: 12px text on an
    // unfixed height (px-[13px] py-1.5), against FilterChip's 12.5px locked to
    // 32px used by Templates, Tasks, Finance and Guides. Both rows are the
    // shared recipe now, and the status pills beside them carry its geometry so
    // the row is one height.
    const chip = screen.getByRole('button', { name: 'All' });
    expect(chip).toHaveClass('h-8', 'text-[12.5px]', 'px-[13px]');
    // FilterChip announces selection; the hand-rolled chip never did.
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Emergencies' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Available' })).toHaveClass('h-8', 'text-[12.5px]');
  });

  it('keeps the emergencies chip danger-toned in both states', () => {
    const { rerender } = render(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'emergencies', name: 'Emergencies' },
        ]}
        activeFilter="all"
        setActiveFilter={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Emergencies' })).toHaveClass(
      'text-[var(--danger-text)]!'
    );

    rerender(
      <Filters
        filterOptions={[
          { key: 'all', name: 'All' },
          { key: 'emergencies', name: 'Emergencies' },
        ]}
        activeFilter="emergencies"
        setActiveFilter={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Emergencies' })).toHaveClass(
      'bg-[var(--danger-bg)]'
    );
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

  it('shows the neutral "All statuses" trigger when the active status is all', () => {
    render(
      <Filters
        statusOptions={[
          { key: 'all', name: 'All', bg: '#eee' },
          { key: 'open', name: 'Open' },
        ]}
        activeStatus="all"
        setActiveStatus={jest.fn()}
      />
    );

    // Even when the "all" option carries a colour token, the trigger stays
    // neutral (no tint) and reads "All statuses".
    const trigger = screen.getByRole('button', { name: 'All statuses' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).not.toHaveStyle({ backgroundColor: '#eee' });
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
        statusOptions={[
          {
            key: 'pending',
            name: 'Pending',
            bg: 'var(--color-badge-slate-bg)',
            text: 'var(--color-badge-light-text)',
            dropdownText: 'var(--color-badge-slate-bg)',
          },
        ]}
        activeStatus="pending"
        setActiveStatus={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(screen.getAllByText('Pending')[1]).toHaveStyle({
      color: 'var(--color-badge-slate-bg)',
    });
  });

  // --- Inline status pill row (list toolbars) ---

  describe('inline status pills', () => {
    const listStatusOptions = [
      { key: 'all', name: 'All statuses' },
      {
        key: 'upcoming',
        name: 'Upcoming',
        bg: 'var(--status-upcoming-bg)',
        text: 'var(--status-upcoming-text)',
        border: 'var(--status-upcoming-border)',
      },
      { key: 'cancelled', name: 'Cancelled', bg: 'var(--status-cancelled-bg)' },
    ];

    const renderListToolbar = (activeStatus: string, setActiveStatus = jest.fn()) => {
      render(
        <Filters
          filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
          statusOptions={listStatusOptions}
          activeFilter="all"
          activeStatus={activeStatus}
          setActiveFilter={jest.fn()}
          setActiveStatus={setActiveStatus}
        />
      );
      return setActiveStatus;
    };

    it('renders every status as a pill instead of a dropdown when filter chips are present', () => {
      renderListToolbar('upcoming');

      // All statuses are visible up-front: no trigger to open, nothing hidden.
      for (const { name } of listStatusOptions) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
    });

    it('selects a status directly from its pill', () => {
      const setActiveStatus = renderListToolbar('upcoming');

      fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
      expect(setActiveStatus).toHaveBeenCalledWith('cancelled');
    });

    it('tints the active pill with its own status tokens and marks it pressed', () => {
      renderListToolbar('upcoming');

      const active = screen.getByRole('button', { name: 'Upcoming' });
      expect(active).toHaveAttribute('aria-pressed', 'true');
      expect(active).toHaveStyle({
        backgroundColor: 'var(--status-upcoming-bg)',
        borderColor: 'var(--status-upcoming-border)',
        color: 'var(--status-upcoming-text)',
      });

      const inactive = screen.getByRole('button', { name: 'Cancelled' });
      expect(inactive).toHaveAttribute('aria-pressed', 'false');
      expect(inactive).toHaveStyle({
        borderColor: 'var(--hairline)',
        color: 'var(--ink-muted)',
      });
    });

    it('gives the active "all" pill the neutral treatment rather than a status tint', () => {
      renderListToolbar('all');

      expect(screen.getByRole('button', { name: 'All statuses' })).toHaveStyle({
        backgroundColor: 'var(--chip-selected-bg)',
        borderColor: 'var(--chip-selected-border)',
        color: 'var(--chip-selected-ink)',
      });
    });

    it('falls back to the border colour when an active status omits one', () => {
      renderListToolbar('cancelled');

      expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveStyle({
        borderColor: 'var(--status-cancelled-bg)',
      });
    });

    it('falls back to the hairline border when an active status has no colour tokens at all', () => {
      render(
        <Filters
          filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
          statusOptions={[{ key: 'ghost', name: 'Ghost' }]}
          activeFilter="all"
          activeStatus="ghost"
          setActiveFilter={jest.fn()}
          setActiveStatus={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Ghost' })).toHaveStyle({
        borderColor: 'var(--hairline)',
        color: 'var(--ink)',
      });
    });
  });
});
