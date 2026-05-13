import React from 'react';
import { render, screen } from '@testing-library/react';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';

describe('AppointmentEstimatePanel', () => {
  it('shows cost and discount when provided', () => {
    render(<AppointmentEstimatePanel cost={100} maxDiscount={20} />);
    expect(screen.getAllByText('$ 100.00')).toHaveLength(2);
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('uses cost as the estimate without subtracting max discount', () => {
    render(<AppointmentEstimatePanel cost={100} maxDiscount={20} />);
    expect(screen.getAllByText('$ 100.00')).toHaveLength(2);
  });

  it('keeps estimate at cost when discount exceeds cost', () => {
    render(<AppointmentEstimatePanel cost={10} maxDiscount={50} />);
    expect(screen.getAllByText('$ 10.00')).toHaveLength(2);
  });

  it('shows dashes when cost and discount are zero', () => {
    render(<AppointmentEstimatePanel cost={0} maxDiscount={0} />);
    const dashes = screen.getAllByText('-');
    expect(dashes).toHaveLength(2);
  });

  it('defaults currency to USD', () => {
    render(<AppointmentEstimatePanel cost={50} maxDiscount={0} />);
    expect(screen.getByText('Cost (USD):')).toBeInTheDocument();
  });

  it('uses provided currency label', () => {
    render(<AppointmentEstimatePanel cost={50} maxDiscount={0} currency="GBP" />);
    expect(screen.getByText('Cost (GBP):')).toBeInTheDocument();
  });

  it('handles string cost and discount values', () => {
    render(<AppointmentEstimatePanel cost="75.50" maxDiscount="15.50" />);
    expect(screen.getAllByText('$ 75.50')).toHaveLength(2);
    expect(screen.getByText('$15.50')).toBeInTheDocument();
  });

  it('renders the Estimate label', () => {
    render(<AppointmentEstimatePanel cost={0} maxDiscount={0} />);
    expect(screen.getByText('Estimate')).toBeInTheDocument();
  });

  it('renders Max discount label', () => {
    render(<AppointmentEstimatePanel cost={0} maxDiscount={0} />);
    expect(screen.getByText('Max discount:')).toBeInTheDocument();
  });
});
