import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import { useSearchStore } from '@/app/stores/searchStore';

describe('MobileSearchBar', () => {
  beforeEach(() => {
    act(() => {
      useSearchStore.getState().clear();
    });
  });

  it('renders with the default placeholder', () => {
    render(<MobileSearchBar />);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('renders with a custom placeholder', () => {
    render(<MobileSearchBar placeholder="Find companions" />);
    expect(screen.getByPlaceholderText('Find companions')).toBeInTheDocument();
  });

  it('reflects the current search store query value', () => {
    act(() => {
      useSearchStore.getState().setQuery('fluffy');
    });
    render(<MobileSearchBar />);
    expect(screen.getByRole('searchbox')).toHaveValue('fluffy');
  });

  it('updates the search store when the user types', () => {
    render(<MobileSearchBar />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new query' } });
    expect(useSearchStore.getState().query).toBe('new query');
  });
});
