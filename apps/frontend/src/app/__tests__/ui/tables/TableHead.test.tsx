import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TableHead from '@/app/ui/tables/TableHead';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'qty', label: 'Qty', align: 'right' as const },
  { key: 'actions', label: '' },
];

describe('TableHead', () => {
  it('is sticky by default, matching the real table header', () => {
    // Every production consumer so far passes sticky={false} because it sits in
    // a drawer, which left the default - the one that matches `.TableDiv thead
    // tr th` - with no coverage at all.
    const { container } = render(<TableHead columns={COLUMNS} track="1fr 80px 44px" />);

    const band = container.firstChild as HTMLElement;
    expect(band).toHaveClass('yc-table-head');
    expect(band).not.toHaveClass('yc-table-head--static');
  });

  it('opts out of sticky when asked', () => {
    const { container } = render(
      <TableHead columns={COLUMNS} track="1fr 80px 44px" sticky={false} />
    );

    expect(container.firstChild).toHaveClass('yc-table-head--static');
  });

  it('lays the labels over the caller track so header and rows stay aligned', () => {
    const { container } = render(<TableHead columns={COLUMNS} track="1fr 80px 44px" gap="12px" />);

    const band = container.firstChild as HTMLElement;
    expect(band).toHaveStyle({ gridTemplateColumns: '1fr 80px 44px', gap: '12px' });
  });

  it('renders a spacer for a blank column rather than announcing an empty header', () => {
    render(<TableHead columns={COLUMNS} track="1fr 80px 44px" />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toHaveClass('text-right');
    // The action column holds its track but says nothing to a screen reader.
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('carries no ARIA table roles', () => {
    // `role="columnheader"` needs a `role="table"` ancestor, and these shells
    // render plain divs for their rows - announcing a header for a table a
    // screen reader cannot navigate is worse than announcing nothing. axe
    // flagged exactly this when the roles were present.
    const { container } = render(<TableHead columns={COLUMNS} track="1fr 80px 44px" />);

    expect(container.querySelector('[role="columnheader"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
  });
});
