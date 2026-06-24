import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoapNotesList, {
  type SoapNoteListItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapNotesList';

const items: SoapNoteListItem[] = [
  {
    id: 'soap-1',
    signedByName: 'Dr. Tim Apple',
    date: 'Apr 21, 2026',
    time: '09:45 AM IST',
    fields: [
      { label: 'Chief complaint', text: 'vomiting and feeling sick' },
      { label: 'Subjective (History)', html: '<p>owner reports limping</p>' },
      { label: 'Plan', html: '<ul><li>Amoxicillin</li></ul>' },
    ],
  },
];

describe('SoapNotesList', () => {
  it('renders an empty state when there are no notes', () => {
    render(<SoapNotesList items={[]} />);
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText('No SOAP notes recorded yet.')).toBeInTheDocument();
  });

  it('renders a floating-label container with one row per note', () => {
    render(<SoapNotesList items={items} />);
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    expect(screen.getByText(/By Dr. Tim Apple/)).toBeInTheDocument();
    // Date, time and time zone render together on a single row.
    expect(screen.getByText('Apr 21, 2026 · 09:45 AM IST')).toBeInTheDocument();
  });

  it('does not render a status chip or a print action on the row', () => {
    render(<SoapNotesList items={items} />);
    expect(screen.queryByText('Signed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /print soap note/i })).not.toBeInTheDocument();
  });

  it('expands and collapses the nested read-out', () => {
    render(<SoapNotesList items={items} />);
    expect(screen.queryByText('vomiting and feeling sick')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr\. tim apple/i }));
    expect(screen.getByText('vomiting and feeling sick')).toBeInTheDocument();
    expect(screen.getByText('owner reports limping')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hide soap note by dr\. tim apple/i }));
    expect(screen.queryByText('vomiting and feeling sick')).not.toBeInTheDocument();
  });

  it('renders a dash for empty rich-text and empty plain-text fields', () => {
    render(
      <SoapNotesList
        items={[
          {
            id: 's',
            signedByName: 'Dr X',
            fields: [
              { label: 'Plan', html: '' },
              { label: 'Chief complaint', text: '' },
            ],
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr x/i }));
    // Both the empty html field and the empty plain-text field collapse to a dash.
    expect(screen.getAllByText('-')).toHaveLength(2);
  });
});
