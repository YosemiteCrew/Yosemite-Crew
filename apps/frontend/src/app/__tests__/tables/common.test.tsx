import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  NoDataMessage,
  ViewButton,
  RescheduleButton,
  ProfileTitle,
  ProfileSubtitle,
} from '@/app/ui/tables/common';

describe('tables/common', () => {
  it('renders the no-data message', () => {
    render(<NoDataMessage />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('calls onClick when the view button is clicked', () => {
    const onClick = jest.fn();
    render(<ViewButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when the reschedule button is clicked', () => {
    const onClick = jest.fn();
    render(<RescheduleButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders profile title children', () => {
    render(<ProfileTitle>Jane Doe</ProfileTitle>);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders profile subtitle children', () => {
    render(<ProfileSubtitle>Owner</ProfileSubtitle>);
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });
});
