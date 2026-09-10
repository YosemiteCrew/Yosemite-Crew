import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import {
  CompanionSelect,
  type CompanionSelectOption,
} from '@/app/features/appointments/components/CompanionSelect';

const companions: CompanionSelectOption[] = [
  { id: 'c1', name: 'Bella', ownerName: 'Maria Chen' },
  { id: 'c2', name: 'Rocky' },
];

describe('CompanionSelect', () => {
  it('renders a searchable dropdown trigger labelled with the stacked label, not a native select', () => {
    render(
      <CompanionSelect
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value=""
        onChange={jest.fn()}
        companions={companions}
      />
    );

    expect(screen.getByText('Companion')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Companion' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.getByText('Select a companion')).toBeInTheDocument();
  });

  it('appends the owner name only when the companion has one', async () => {
    const user = userEvent.setup();
    render(
      <CompanionSelect
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value=""
        onChange={jest.fn()}
        companions={companions}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Companion' }));

    expect(screen.getByRole('option', { name: 'Bella — Maria Chen' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rocky' })).toBeInTheDocument();
  });

  it('calls onChange with the picked companion id', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <CompanionSelect
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value=""
        onChange={onChange}
        companions={companions}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Companion' }));
    await user.click(screen.getByRole('option', { name: 'Rocky' }));

    expect(onChange).toHaveBeenCalledWith('c2');
  });

  it('shows the current selection by id', () => {
    render(
      <CompanionSelect
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value="c1"
        onChange={jest.fn()}
        companions={companions}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Companion: Bella — Maria Chen' })
    ).toBeInTheDocument();
  });

  it('disables itself and shows emptyLabel when there are no companions to pick', () => {
    render(
      <CompanionSelect
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value=""
        onChange={jest.fn()}
        companions={[]}
      />
    );

    expect(screen.getByRole('button', { name: 'Companion' })).toBeDisabled();
    expect(screen.getByText('No companions available')).toBeInTheDocument();
    expect(screen.queryByText('Select a companion')).not.toBeInTheDocument();
  });
});
