import { render, screen } from '@testing-library/react';
import CalculatorResult from '@/app/features/calculators/components/CalculatorResult';

describe('CalculatorResult', () => {
  it('renders a single result as a serif hero with its label as the eyebrow', () => {
    render(<CalculatorResult rows={[{ label: 'Corrected sodium', value: '148 mEq/L' }]} />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    // The label becomes the eyebrow heading; the value is the serif hero.
    expect(screen.getByRole('heading', { name: 'Corrected sodium' })).toBeInTheDocument();
    expect(screen.getByText('148 mEq/L')).toBeInTheDocument();
    // No generic "Result" heading in the single-value layout.
    expect(screen.queryByRole('heading', { name: 'Result' })).not.toBeInTheDocument();
  });

  it('renders multiple results as a labelled list under a Result heading', () => {
    render(
      <CalculatorResult
        rows={[
          { label: 'Maintenance', value: '600 mL/day' },
          { label: 'Total volume', value: '1200 mL/day' },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('600 mL/day')).toBeInTheDocument();
    expect(screen.getByText('Total volume')).toBeInTheDocument();
    expect(screen.getByText('1200 mL/day')).toBeInTheDocument();
  });
});
