import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../../__tests__/setup/mockTheme';
import {TimeSlotPills} from '@/features/appointments/components/TimeSlotPills/TimeSlotPills';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const baseSlots = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
];
const onSelect = jest.fn();

describe('TimeSlotPills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all slot labels', () => {
    render(
      <TimeSlotPills slots={baseSlots} selected={null} onSelect={onSelect} />,
    );
    baseSlots.forEach(slot => {
      expect(screen.getByText(slot)).toBeTruthy();
    });
  });

  it('renders nothing crashably with empty slots', () => {
    expect(() =>
      render(<TimeSlotPills slots={[]} selected={null} onSelect={onSelect} />),
    ).not.toThrow();
  });

  it('calls onSelect with the tapped slot', () => {
    render(
      <TimeSlotPills slots={baseSlots} selected={null} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByText('10:00'));
    expect(onSelect).toHaveBeenCalledWith('10:00');
  });

  it('calls onSelect for the first slot', () => {
    render(
      <TimeSlotPills slots={baseSlots} selected={null} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByText('09:00'));
    expect(onSelect).toHaveBeenCalledWith('09:00');
  });

  it('renders with a selected slot without crashing', () => {
    expect(() =>
      render(
        <TimeSlotPills
          slots={baseSlots}
          selected="10:00"
          onSelect={onSelect}
        />,
      ),
    ).not.toThrow();
  });

  it('renders three slots per column (7 slots → 3 columns)', () => {
    render(
      <TimeSlotPills slots={baseSlots} selected={null} onSelect={onSelect} />,
    );
    // All 7 slots must appear in the rendered output
    expect(screen.getAllByText(/^\d{2}:\d{2}$/).length).toBe(7);
  });

  it('renders a single slot without error', () => {
    expect(() =>
      render(
        <TimeSlotPills slots={['09:00']} selected={null} onSelect={onSelect} />,
      ),
    ).not.toThrow();
    expect(screen.getByText('09:00')).toBeTruthy();
  });

  it('renders exactly three slots in the first column', () => {
    render(
      <TimeSlotPills
        slots={['08:00', '08:30', '09:00', '09:30']}
        selected={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('08:30')).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('09:30')).toBeTruthy();
  });

  it('accepts a resetKey prop without crashing', () => {
    expect(() =>
      render(
        <TimeSlotPills
          slots={baseSlots}
          selected={null}
          onSelect={onSelect}
          resetKey="reset-1"
        />,
      ),
    ).not.toThrow();
  });

  it('exposes the selected state to screen readers via accessibilityState', () => {
    render(
      <TimeSlotPills slots={baseSlots} selected="10:00" onSelect={onSelect} />,
    );

    const selected = screen.getByLabelText('10:00');
    expect(selected.props.accessibilityRole).toBe('radio');
    expect(selected.props.accessibilityState).toEqual({selected: true});

    const unselected = screen.getByLabelText('09:00');
    expect(unselected.props.accessibilityState).toEqual({selected: false});
  });

  it('accepts a numeric resetKey prop', () => {
    expect(() =>
      render(
        <TimeSlotPills
          slots={baseSlots}
          selected={null}
          onSelect={onSelect}
          resetKey={42}
        />,
      ),
    ).not.toThrow();
  });
});
