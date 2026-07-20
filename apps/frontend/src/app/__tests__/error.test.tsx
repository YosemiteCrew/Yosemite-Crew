import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GlobalError from '@/app/error';

describe('GlobalError (root error boundary)', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders the warm-bone state card with both actions', () => {
    render(<GlobalError error={new Error('boom')} reset={jest.fn()} />);

    expect(screen.getByText('Something went wrong')).toHaveClass('yc-state-title');
    expect(screen.getByText(/unexpected error occurred/i)).toHaveClass('yc-state-text');
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('logs the error once on mount', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(consoleError).toHaveBeenCalledWith('Unhandled application error:', error);
  });

  it('calls reset when "Try again" is clicked', () => {
    const reset = jest.fn();
    render(<GlobalError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByText('Try again'));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
