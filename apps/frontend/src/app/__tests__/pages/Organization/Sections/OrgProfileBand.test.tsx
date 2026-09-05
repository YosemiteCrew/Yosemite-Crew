import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import OrgProfileBand from '@/app/features/organization/pages/Organization/Sections/OrgProfileBand';
import { Organisation } from '@yosemite-crew/types';

const baseOrg: Organisation = {
  name: 'Alpenblick Animal Clinic',
  type: 'HOSPITAL',
  phoneNo: '+49 8821',
  taxId: 'DE123',
  DUNSNumber: '31-482',
  website: 'alpenblick.vet',
  isVerified: true,
  address: { addressLine: 'Bergweg 3', postalCode: '82467', city: 'Garmisch' },
  appointmentCheckInBufferMinutes: 5,
  appointmentCheckInRadiusMeters: 200,
};

describe('OrgProfileBand', () => {
  it('renders the verified identity band with pills and meta lines', () => {
    render(<OrgProfileBand org={baseOrg} canEdit onEdit={jest.fn()} />);

    expect(screen.getByText('Alpenblick Animal Clinic')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('HOSPITAL')).toBeInTheDocument();
    expect(screen.getByText(/Bergweg 3, 82467 Garmisch/)).toBeInTheDocument();
    expect(screen.getByText(/Tax ID DE123/)).toBeInTheDocument();
    expect(screen.getByText(/Check-in buffer: 5 min/)).toBeInTheDocument();
    expect(screen.getByText(/DUNS 31-482/)).toBeInTheDocument();
  });

  it('renders a PENDING pill when the org is not verified', () => {
    render(<OrgProfileBand org={{ ...baseOrg, isVerified: false }} canEdit onEdit={jest.fn()} />);

    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.queryByText('VERIFIED')).not.toBeInTheDocument();
  });

  it('renders the logo image when an imageURL is present', () => {
    const { container } = render(
      <OrgProfileBand
        org={{ ...baseOrg, imageURL: 'https://example.com/logo.png' }}
        canEdit
        onEdit={jest.fn()}
      />
    );

    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('calls onEdit when the Edit profile pill is clicked', () => {
    const onEdit = jest.fn();
    render(<OrgProfileBand org={baseOrg} canEdit onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /Edit profile/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  /**
   * Pins the shared primitive rather than the old hand-rolled string. This pill
   * was `h-[38px] … px-4! text-[12.5px]` here and `h-[34px] … px-[15px]
   * text-[12px]` on Settings for the identical action, so "Edit profile" changed
   * size with the page and neither height was on the 32/36/40/44 scale
   * `Secondary` offers. `min-h-9 px-4 text-[12.5px]` IS Secondary's `small`
   * (Buttons/Secondary.tsx:11), so this fails if the button is hand-rolled again
   * or moved to another size.
   */
  it('renders Edit profile through the shared Secondary primitive at size small', () => {
    render(<OrgProfileBand org={baseOrg} canEdit onEdit={jest.fn()} />);

    const edit = screen.getByRole('button', { name: /Edit profile/ });
    expect(edit.className).toContain('min-h-9');
    expect(edit.className).toContain('px-4');
    expect(edit.className).toContain('text-[12.5px]');
    expect(edit.className).not.toContain('h-[38px]');
  });

  it('hides the Edit profile pill when editing is not permitted', () => {
    render(<OrgProfileBand org={baseOrg} canEdit={false} onEdit={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /Edit profile/ })).not.toBeInTheDocument();
  });

  it('falls back to a generic name when the org name is blank', () => {
    render(<OrgProfileBand org={{ ...baseOrg, name: '' }} canEdit onEdit={jest.fn()} />);

    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  it('omits the meta lines when the org has no address, tax or check-in data', () => {
    const bareOrg: Organisation = {
      name: 'Bare Clinic',
      type: 'GROOMER',
      phoneNo: '',
      taxId: '',
      isVerified: false,
    };
    render(<OrgProfileBand org={bareOrg} canEdit onEdit={jest.fn()} />);

    expect(screen.getByText('Bare Clinic')).toBeInTheDocument();
    expect(screen.getByText('GROOMER')).toBeInTheDocument();
    expect(screen.queryByText(/Tax ID/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Check-in buffer/)).not.toBeInTheDocument();
  });
});
