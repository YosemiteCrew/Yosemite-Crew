import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BodySurfaceAreaCalculator from '@/app/features/calculators/components/BodySurfaceAreaCalculator';

describe('BodySurfaceAreaCalculator', () => {
  it('calculates BSA and a BSA-normalised dose', async () => {
    const user = userEvent.setup();
    render(<BodySurfaceAreaCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.type(screen.getByLabelText('Dose (mg/m², optional)'), '50');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('0.469 m²')).toBeInTheDocument();
    expect(screen.getByText('23.44 mg')).toBeInTheDocument();
  });

  it('omits the dose row when no dose per m² is given', async () => {
    const user = userEvent.setup();
    render(<BodySurfaceAreaCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('0.469 m²')).toBeInTheDocument();
    expect(screen.queryByText('Total dose')).not.toBeInTheDocument();
  });

  it('uses the cat K factor when species changes', async () => {
    const user = userEvent.setup();
    render(<BodySurfaceAreaCalculator />);

    await user.click(screen.getByRole('button', { name: 'Cat' }));
    await user.type(screen.getByLabelText('Weight (kg)'), '10');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('0.464 m²')).toBeInTheDocument();
  });

  it('shows a validation error for a non-positive weight', async () => {
    const user = userEvent.setup();
    render(<BodySurfaceAreaCalculator />);

    await user.type(screen.getByLabelText('Weight (kg)'), '0');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Weight must be greater than 0.')).toBeInTheDocument();
  });
});
