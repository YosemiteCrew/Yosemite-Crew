import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DrugDoseCalculator from '@/app/features/calculators/components/DrugDoseCalculator';

describe('DrugDoseCalculator', () => {
  it('calculates dose and volume when a concentration is given', async () => {
    const user = userEvent.setup();
    render(<DrugDoseCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dose (mg/kg)'), '5');
    await user.type(screen.getByLabelText('Concentration (mg/mL, optional)'), '10');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('50 mg')).toBeInTheDocument();
    expect(screen.getByText('1 ×/day')).toBeInTheDocument();
    expect(screen.getByText('50 mg/day')).toBeInTheDocument();
    expect(screen.getByText('5 mL')).toBeInTheDocument();
  });

  it('omits the volume row when no concentration is given', async () => {
    const user = userEvent.setup();
    render(<DrugDoseCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dose (mg/kg)'), '5');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('50 mg')).toBeInTheDocument();
    expect(screen.queryByText('Volume per administration')).not.toBeInTheDocument();
  });

  it('multiplies the daily dose by the frequency', async () => {
    const user = userEvent.setup();
    render(<DrugDoseCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dose (mg/kg)'), '5');
    await user.type(screen.getByLabelText('Frequency (per day, optional)'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('150 mg/day')).toBeInTheDocument();
  });

  it('shows a required-field error when weight is blank', async () => {
    const user = userEvent.setup();
    render(<DrugDoseCalculator />);

    await user.type(screen.getByLabelText('Dose (mg/kg)'), '5');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Weight is required.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
