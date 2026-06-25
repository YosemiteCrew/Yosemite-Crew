import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculators from '@/app/features/calculators/pages/Calculators';

describe('Calculators page', () => {
  it('renders the heading and the first calculator by default', () => {
    render(<Calculators />);

    expect(screen.getByRole('heading', { name: 'Veterinary calculators' })).toBeInTheDocument();
    expect(screen.getByText(/Maintenance fluids plus dehydration deficit/i)).toBeInTheDocument();
  });

  it('switches calculator within the active category', async () => {
    const user = userEvent.setup();
    render(<Calculators />);

    await user.click(screen.getByRole('button', { name: 'Constant rate infusion' }));

    expect(screen.getByText(/How much drug to add to a fluid bag/i)).toBeInTheDocument();
  });

  it('switches category and loads its first calculator', async () => {
    const user = userEvent.setup();
    render(<Calculators />);

    await user.click(screen.getByRole('button', { name: 'Electrolytes & metabolic' }));

    expect(screen.getByText(/Sodium corrected for hyperglycemia/i)).toBeInTheDocument();
  });
});
