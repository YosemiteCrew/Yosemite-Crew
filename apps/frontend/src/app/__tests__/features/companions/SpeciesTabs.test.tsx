import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SpeciesTabs from '@/app/features/companions/pages/Companions/SpeciesTabs';

const counts = { all: 12, dog: 5, cat: 4, horse: 1, other: 2 };

describe('SpeciesTabs', () => {
  it('renders every species tab with its live count', () => {
    render(<SpeciesTabs counts={counts} activeFilter="all" onSelect={jest.fn()} />);

    ['All', 'Dogs', 'Cats', 'Horses', 'Exotics'].forEach((label) => {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: /Dogs/ })).toHaveTextContent('5');
    expect(screen.getByRole('tab', { name: /Exotics/ })).toHaveTextContent('2');
  });

  it('marks the active tab and defaults to All when the filter is empty', () => {
    const { rerender } = render(
      <SpeciesTabs counts={counts} activeFilter="" onSelect={jest.fn()} />
    );
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');

    rerender(<SpeciesTabs counts={counts} activeFilter="cat" onSelect={jest.fn()} />);
    expect(screen.getByRole('tab', { name: /Cats/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect with the tab key (Exotics maps to other)', () => {
    const onSelect = jest.fn();
    render(<SpeciesTabs counts={counts} activeFilter="all" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: /Exotics/ }));
    expect(onSelect).toHaveBeenCalledWith('other');

    fireEvent.click(screen.getByRole('tab', { name: /Horses/ }));
    expect(onSelect).toHaveBeenCalledWith('horse');
  });
});
