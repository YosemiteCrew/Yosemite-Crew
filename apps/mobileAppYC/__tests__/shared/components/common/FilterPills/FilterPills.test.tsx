import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  FilterPills,
  type FilterOption,
} from '@/shared/components/common/FilterPills/FilterPills';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const options: FilterOption<string>[] = [
  {id: 'all', label: 'All'},
  {id: 'open', label: 'Open'},
  {id: 'closed', label: 'Closed'},
];

describe('FilterPills', () => {
  it('renders every option label', () => {
    render(
      <FilterPills options={options} selected="all" onSelect={jest.fn()} />,
    );

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Closed')).toBeTruthy();
  });

  it('calls onSelect with the pressed option id', () => {
    const onSelect = jest.fn();
    render(
      <FilterPills options={options} selected="all" onSelect={onSelect} />,
    );

    fireEvent.press(screen.getByText('Open'));
    expect(onSelect).toHaveBeenCalledWith('open');
  });

  it('exposes the selected state to screen readers via accessibilityState', () => {
    render(
      <FilterPills options={options} selected="open" onSelect={jest.fn()} />,
    );

    const selected = screen.getByLabelText('Open');
    expect(selected.props.accessibilityRole).toBe('radio');
    expect(selected.props.accessibilityState).toEqual({selected: true});

    const unselected = screen.getByLabelText('All');
    expect(unselected.props.accessibilityRole).toBe('radio');
    expect(unselected.props.accessibilityState).toEqual({selected: false});
  });
});
