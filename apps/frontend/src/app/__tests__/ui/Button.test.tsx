import React from 'react';
import { render, screen } from '@testing-library/react';
import Button from '@/app/ui/Button';

jest.mock('@/app/ui/primitives/Buttons/Primary', () => ({
  __esModule: true,
  default: ({ text, className }: { text: string; className?: string }) => (
    <button type="button" className={className} data-testid="primary-button">
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, className }: { text: string; className?: string }) => (
    <button type="button" className={className} data-testid="secondary-button">
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, className }: { text: string; className?: string }) => (
    <button type="button" className={className} data-testid="danger-button">
      {text}
    </button>
  ),
}));

describe('Button', () => {
  it('renders the primary primitive by default', () => {
    render(<Button text="Save" className="custom-class" />);

    expect(screen.getByTestId('primary-button')).toHaveTextContent('Save');
    expect(screen.getByTestId('primary-button')).toHaveClass('custom-class');
  });

  it('routes secondary and danger variants to their matching primitives', () => {
    const { rerender } = render(<Button text="Cancel" variant="secondary" />);

    expect(screen.getByTestId('secondary-button')).toHaveTextContent('Cancel');

    rerender(<Button text="Delete" variant="danger" />);

    expect(screen.getByTestId('danger-button')).toHaveTextContent('Delete');
  });
});
