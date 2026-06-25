import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalculatorForm from '@/app/features/calculators/components/CalculatorForm';
import { CALCULATORS, type CalculatorConfig } from '@/app/features/calculators/registry';

const config = (key: string): CalculatorConfig => {
  const found = CALCULATORS.find((calc) => calc.key === key);
  if (!found) throw new Error(`missing config ${key}`);
  return found;
};

describe('CalculatorForm', () => {
  it('renders the species selector and fields, then computes a result', async () => {
    const user = userEvent.setup();
    render(<CalculatorForm config={config('fluid-rate')} />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dehydration (%)'), '5');
    await user.type(screen.getByLabelText('Ongoing losses (mL/day, optional)'), '100');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('600 mL/day')).toBeInTheDocument();
    expect(screen.getByText('1200 mL/day')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a field error and clears the result on invalid input', async () => {
    const user = userEvent.setup();
    render(<CalculatorForm config={config('fluid-rate')} />);

    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Weight is required.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('recomputes when the species changes', async () => {
    const user = userEvent.setup();
    render(<CalculatorForm config={config('fluid-rate')} />);

    await user.click(screen.getByRole('button', { name: 'Cat' }));
    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dehydration (%)'), '5');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('500 mL/day')).toBeInTheDocument();
  });

  it('renders a date field for date-typed inputs', () => {
    render(<CalculatorForm config={config('gestation')} />);

    expect(screen.getByLabelText('Breeding date')).toHaveAttribute('type', 'date');
  });

  it('omits the species selector for a non-species calculator', async () => {
    const user = userEvent.setup();
    render(<CalculatorForm config={config('corrected-sodium')} />);

    expect(screen.queryByRole('button', { name: 'Dog' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Measured sodium (mEq/L)'), '140');
    await user.type(screen.getByLabelText('Glucose (mg/dL)'), '600');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('148 mEq/L')).toBeInTheDocument();
  });
});
