import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Search from '@/app/ui/inputs/Search';

// --- Mocks ---

jest.mock('react-icons/io5', () => ({
  IoSearch: () => <svg data-testid="search-icon" />,
}));

expect.extend(toHaveNoViolations);

describe('Search Component', () => {
  const mockSetSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it('renders correctly with default props', () => {
    render(<Search value="" setSearch={mockSetSearch} />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('renders with a specific initial value', () => {
    render(<Search value="Test Query" setSearch={mockSetSearch} />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toHaveValue('Test Query');
  });

  // --- 2. Interaction (Typing) ---

  it('calls setSearch when typing in the input', () => {
    render(<Search value="" setSearch={mockSetSearch} />);

    const input = screen.getByRole('searchbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'Hello' } });

    expect(mockSetSearch).toHaveBeenCalledTimes(1);
    expect(mockSetSearch).toHaveBeenCalledWith('Hello');
  });

  // --- 3. Optional Props (className) ---

  it('applies custom className correctly', () => {
    render(<Search value="" setSearch={mockSetSearch} className="custom-class-test" />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    const container = input.parentElement;

    expect(container).toHaveClass('custom-class-test');
    expect(container).toHaveClass('rounded-2xl');
  });

  it('renders correctly without className prop', () => {
    render(<Search value="" setSearch={mockSetSearch} />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    const container = input.parentElement;

    expect(container?.className).not.toContain('undefined');
  });

  it('supports a custom accessible label', () => {
    render(
      <Search
        value=""
        setSearch={mockSetSearch}
        placeholder="Search appointments"
        label="Global search"
      />
    );

    expect(screen.getByRole('searchbox', { name: 'Global search' })).toBeInTheDocument();
  });

  // --- 4. Accessibility ---

  it('has no axe accessibility violations', async () => {
    const { container } = render(<Search value="" setSearch={mockSetSearch} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations with custom label', async () => {
    const { container } = render(
      <Search value="query" setSearch={mockSetSearch} label="Search patients" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
