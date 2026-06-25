import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculators from '@/app/features/calculators/pages/Calculators';

describe('Calculators page', () => {
  it('renders the heading and the fluid-rate calculator by default', () => {
    render(<Calculators />);

    expect(screen.getByRole('heading', { name: 'Veterinary calculators' })).toBeInTheDocument();
    expect(screen.getByText(/Maintenance fluids plus dehydration deficit/i)).toBeInTheDocument();
  });

  it('switches to the drug-dose calculator', async () => {
    const user = userEvent.setup();
    render(<Calculators />);

    await user.click(screen.getByRole('button', { name: 'Drug dose' }));

    expect(screen.getByText(/Dose by body weight/i)).toBeInTheDocument();
  });

  it('switches to the body-surface-area calculator', async () => {
    const user = userEvent.setup();
    render(<Calculators />);

    await user.click(screen.getByRole('button', { name: 'Body surface area' }));

    expect(screen.getByText(/Body surface area from weight/i)).toBeInTheDocument();
  });
});
