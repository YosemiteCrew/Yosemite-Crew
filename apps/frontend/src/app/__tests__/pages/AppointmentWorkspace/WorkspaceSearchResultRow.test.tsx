import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';

/* The two ATCvet rows that motivated the tooltip: identical once the origin
   line clips, and one digit apart in the code. */
const SYSTEMIC =
  'QJ01CR02 · ANTIBACTERIALS FOR SYSTEMIC USE · BETA-LACTAM ANTIBACTERIALS, PENICILLINS';
const INTRAMAMMARY =
  'QJ51CR02 · ANTIBACTERIALS FOR INTRAMAMMARY USE · BETA-LACTAM ANTIBACTERIALS, PENICILLINS';

describe('WorkspaceSearchResultRow', () => {
  it('carries the full name and origin as tooltips, so a clipped line stays readable', () => {
    render(
      <ul>
        <WorkspaceSearchResultRow
          name="amoxicillin and beta-lactamase inhibitor"
          origin={SYSTEMIC}
          onSelect={jest.fn()}
        />
        <WorkspaceSearchResultRow
          name="amoxicillin and enzyme inhibitor"
          origin={INTRAMAMMARY}
          onSelect={jest.fn()}
        />
      </ul>
    );

    expect(screen.getByText(SYSTEMIC)).toHaveAttribute('title', SYSTEMIC);
    expect(screen.getByText(INTRAMAMMARY)).toHaveAttribute('title', INTRAMAMMARY);
    expect(screen.getByText('amoxicillin and enzyme inhibitor')).toHaveAttribute(
      'title',
      'amoxicillin and enzyme inhibitor'
    );
  });

  it('leaves the disabled reason as the only tooltip on a disabled row', () => {
    render(
      <ul>
        <WorkspaceSearchResultRow
          name="amoxicillin and enzyme inhibitor"
          origin={INTRAMAMMARY}
          disabled
          disabledReason="Added"
          onSelect={jest.fn()}
        />
      </ul>
    );

    /* A nested title wins over an ancestor's, so leaving one on the inner spans
       would hide "Added" behind the text the user already picked. */
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Added');
    expect(screen.getByText(INTRAMAMMARY)).not.toHaveAttribute('title');
    expect(screen.getByText('amoxicillin and enzyme inhibitor')).not.toHaveAttribute('title');
  });
});
