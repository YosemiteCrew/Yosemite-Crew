import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ClinicalListEmpty,
  ClinicalListError,
  ClinicalListHeader,
  ClinicalListLoadingRows,
} from '@/app/features/companionHistory/components/ClinicalListChrome';
import { formatDate } from '@/app/features/companionHistory/components/clinicalListStyles';

const headerProps = {
  icon: <span data-testid="icon" />,
  headingId: 'x-heading',
  title: 'Allergies',
  activeCount: 0,
  loading: false,
  canEdit: false,
  showForm: false,
  onToggle: () => undefined,
  addLabel: 'Add allergy',
};

describe('formatDate', () => {
  it('returns null for a missing value', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('returns null for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBeNull();
  });

  it('formats a valid ISO date', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleDateString');
    expect(formatDate('2026-03-04T00:00:00.000Z')).toMatch(/2026/);
    expect(spy).toHaveBeenCalledWith(undefined, expect.objectContaining({ timeZone: 'UTC' }));
    spy.mockRestore();
  });
});

describe('ClinicalListChrome pieces', () => {
  it('renders the empty message', () => {
    render(<ClinicalListEmpty message="Nothing here yet." />);
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('renders three placeholder rows while loading', () => {
    const { container } = render(<ClinicalListLoadingRows />);
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders nothing without an error, and an alert with one', () => {
    const { container, rerender } = render(<ClinicalListError error={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ClinicalListError error="Could not load." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.');
  });
});

describe('ClinicalListHeader', () => {
  it('shows the title and its icon, and links the heading id', () => {
    render(<ClinicalListHeader {...headerProps} />);
    expect(screen.getByRole('heading', { name: 'Allergies' })).toHaveAttribute('id', 'x-heading');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('withholds the active pill while loading, on error, or at zero', () => {
    const { rerender } = render(<ClinicalListHeader {...headerProps} activeCount={0} />);
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
    rerender(<ClinicalListHeader {...headerProps} activeCount={3} loading />);
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
    rerender(<ClinicalListHeader {...headerProps} activeCount={3} error="Could not load." />);
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
  });

  it('shows the active count once loaded', () => {
    render(<ClinicalListHeader {...headerProps} activeCount={3} />);
    expect(screen.getByText('3 active')).toHaveAttribute(
      'style',
      expect.stringContaining('pill-warning-bg')
    );
  });

  it('hides the add control without edit permission', () => {
    render(<ClinicalListHeader {...headerProps} canEdit={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles the form and swaps the label', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <ClinicalListHeader {...headerProps} canEdit onToggle={onToggle} />
    );
    const button = screen.getByRole('button', { name: /Add allergy/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
    rerender(<ClinicalListHeader {...headerProps} canEdit showForm onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /Close/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the button label for screen readers when it collapses to an icon on phones', () => {
    const { rerender } = render(<ClinicalListHeader {...headerProps} canEdit />);
    const button = screen.getByRole('button', { name: 'Add allergy' });
    expect(button).toHaveClass('max-md:size-11');
    expect(within(button).getByText('Add allergy')).toHaveClass('max-md:sr-only');
    expect(screen.getByRole('banner')).toHaveClass('max-md:py-2', 'max-md:pr-2');

    rerender(<ClinicalListHeader {...headerProps} canEdit={false} />);
    expect(screen.getByRole('banner')).not.toHaveClass('max-md:py-2');
  });

  it('swaps the plus icon for a close icon while the form is open', () => {
    const { container, rerender } = render(<ClinicalListHeader {...headerProps} canEdit />);
    const plus = container.querySelector('button svg')?.innerHTML;
    rerender(<ClinicalListHeader {...headerProps} canEdit showForm />);
    const close = container.querySelector('button svg')?.innerHTML;
    expect(plus).toBeTruthy();
    expect(close).toBeTruthy();
    expect(close).not.toBe(plus);
  });

  it('names the count and tone when a list counts something other than active records', () => {
    render(
      <ClinicalListHeader
        {...headerProps}
        activeCount={4}
        countLabel="recorded"
        countTone="neutral"
      />
    );
    expect(screen.getByText('4 recorded')).toHaveAttribute(
      'style',
      expect.stringContaining('pill-neutral-bg')
    );
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
  });
});
