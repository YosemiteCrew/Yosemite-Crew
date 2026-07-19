import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalculatorBrowser from '@/app/features/calculators/components/CalculatorBrowser';

describe('CalculatorBrowser', () => {
  it('renders the category pill and calculator dropdown with the first calculator by default', () => {
    render(<CalculatorBrowser />);

    const categories = screen.getByRole('group', { name: 'Calculator category' });
    expect(within(categories).getByRole('button', { name: 'Fluids & emergency' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /Calculator: Fluid rate/ })).toBeInTheDocument();
    expect(screen.getByText(/Maintenance fluids plus dehydration deficit/i)).toBeInTheDocument();
  });

  it('switches category from the segmented pill and loads its first calculator', async () => {
    const user = userEvent.setup();
    render(<CalculatorBrowser />);

    const categories = screen.getByRole('group', { name: 'Calculator category' });
    await user.click(within(categories).getByRole('button', { name: 'Electrolytes & metabolic' }));

    expect(
      within(categories).getByRole('button', { name: 'Electrolytes & metabolic' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Sodium corrected for hyperglycemia/i)).toBeInTheDocument();
  });

  it('switches calculator from the dropdown within a category', async () => {
    const user = userEvent.setup();
    render(<CalculatorBrowser />);

    await user.click(screen.getByRole('button', { name: /Calculator: Fluid rate/ }));
    await user.click(await screen.findByRole('button', { name: 'Constant rate infusion' }));

    expect(screen.getByText(/How much drug to add to a fluid bag/i)).toBeInTheDocument();
  });

  it('passes pre-filled weight and species through to the form', () => {
    render(<CalculatorBrowser initialValues={{ weightKg: '6.8' }} initialSpecies="cat" />);

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.8);
  });
});
