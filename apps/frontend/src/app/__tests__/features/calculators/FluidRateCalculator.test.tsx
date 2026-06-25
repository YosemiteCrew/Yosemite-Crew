import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FluidRateCalculator from '@/app/features/calculators/components/FluidRateCalculator';

describe('FluidRateCalculator', () => {
  it('calculates maintenance, deficit, ongoing losses and infusion rate', async () => {
    const user = userEvent.setup();
    render(<FluidRateCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dehydration (%)'), '5');
    await user.type(screen.getByLabelText('Ongoing losses (mL/day, optional)'), '100');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('600 mL/day')).toBeInTheDocument();
    expect(screen.getByText('500 mL')).toBeInTheDocument();
    expect(screen.getByText('100 mL/day')).toBeInTheDocument();
    expect(screen.getByText('1200 mL/day')).toBeInTheDocument();
    expect(screen.getByText('50 mL/hr')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a required-field error when weight is blank', async () => {
    const user = userEvent.setup();
    render(<FluidRateCalculator />);

    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Weight is required.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('validates the dehydration range', async () => {
    const user = userEvent.setup();
    render(<FluidRateCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dehydration (%)'), '20');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Dehydration must be between 0 and 15.')).toBeInTheDocument();
  });

  it('recomputes using the cat maintenance factor when species changes', async () => {
    const user = userEvent.setup();
    render(<FluidRateCalculator />);

    await user.click(screen.getByRole('button', { name: 'Cat' }));
    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dehydration (%)'), '5');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    // Cat maintenance = 50 mL/kg/day x 10 kg = 500 mL/day (distinct from the 1000 mL/day total).
    expect(screen.getByText('500 mL/day')).toBeInTheDocument();
    expect(screen.getByText('1000 mL/day')).toBeInTheDocument();
  });
});
