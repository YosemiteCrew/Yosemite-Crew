import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalculatorBrowser from '@/app/features/calculators/components/CalculatorBrowser';

describe('CalculatorBrowser', () => {
  it('renders the category and calculator pickers with the first calculator by default', () => {
    render(<CalculatorBrowser />);

    expect(screen.getByRole('button', { name: 'Fluid rate' })).toBeInTheDocument();
    expect(screen.getByText(/Maintenance fluids plus dehydration deficit/i)).toBeInTheDocument();
  });

  it('switches category and loads its first calculator', async () => {
    const user = userEvent.setup();
    render(<CalculatorBrowser />);

    await user.click(screen.getByRole('button', { name: 'Electrolytes & metabolic' }));

    expect(screen.getByText(/Sodium corrected for hyperglycemia/i)).toBeInTheDocument();
  });

  it('passes pre-filled weight and species through to the form', () => {
    render(<CalculatorBrowser initialValues={{ weightKg: '6.8' }} initialSpecies="cat" />);

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);
  });
});
