import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';

describe('StaffField', () => {
  it('renders the label and the assigned name', () => {
    render(<StaffField label="Assigned Lead" name="Dr. Tim Apple" />);
    expect(screen.getByText('Assigned Lead')).toBeInTheDocument();
    expect(screen.getByText('Dr. Tim Apple')).toBeInTheDocument();
  });

  it('shows an Unassigned placeholder and no avatar when empty', () => {
    render(<StaffField label="Support Staff" />);
    expect(screen.getByText('Support Staff')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    // No avatar image/initials are rendered when there is no name.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('notches the label into the border rather than painting a patch behind it', () => {
    render(<StaffField label="Assigned Lead" name="Dr. Tim Apple" />);
    const label = screen.getByText('Assigned Lead');

    // A real legend inside a fieldset: the browser cuts the border where the text
    // sits, so the field is correct on any surface.
    expect(label.tagName).toBe('LEGEND');
    expect(label.closest('fieldset')).not.toBeNull();

    /* And it must paint NOTHING. The old implementation filled `--screen` behind
       the label to fake the gap, which only lined up when the field sat directly
       on the page; on the workspace meta bar it sits on a card, where that patch
       showed as a pale rectangle laid over the border. Any background here is
       that bug returning. */
    expect(label.style.background).toBe('');
    expect(label.style.backgroundColor).toBe('');
  });

  it('fills the field surface with the theme field background so it does not wash out', () => {
    render(<StaffField label="Assigned Lead" name="Dr. Tim Apple" />);
    // The shell is the fieldset the legend sits in; it carries the filled surface.
    const shell = screen.getByText('Assigned Lead').closest('fieldset') as HTMLElement;
    expect(shell).toHaveStyle({ background: 'var(--field-bg)' });
    expect(shell).toHaveStyle({ borderColor: 'var(--hairline)' });
  });
});
