import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OrgProfileEditCards from '@/app/features/organization/pages/Organization/Sections/OrgProfileEditCards';
import { OrgProfileForm } from '@/app/features/organization/pages/Organization/Sections/useOrgProfileForm';

jest.mock('@/app/features/organization/pages/Organization/Sections/ProfileCard', () => ({
  __esModule: true,
  default: ({
    title,
    showProfile,
    onSave,
  }: {
    title: string;
    showProfile?: boolean;
    onSave?: unknown;
  }) => (
    <div data-testid={`card-${title}`}>
      {title} | showProfile={String(!!showProfile)} | editable={String(!!onSave)}
    </div>
  ),
}));

const form: OrgProfileForm = {
  formData: {
    name: 'Clinic',
    type: 'HOSPITAL',
    phoneNo: '1',
    taxId: 't',
    address: { country: 'US' },
    appointmentCheckInBufferMinutes: 5,
    appointmentCheckInRadiusMeters: 200,
  },
  handleOrgSave: jest.fn(),
  handleAddressSave: jest.fn(),
  handleCheckInSave: jest.fn(),
};

describe('OrgProfileEditCards', () => {
  it('renders all three editable cards when the user can edit', () => {
    render(<OrgProfileEditCards form={form} canEditOrg />);

    expect(screen.getByTestId('card-Organization')).toHaveTextContent('editable=true');
    expect(screen.getByTestId('card-Organization')).toHaveTextContent('showProfile=true');
    expect(screen.getByTestId('card-Address')).toHaveTextContent('editable=true');
    expect(screen.getByTestId('card-Check-in settings')).toHaveTextContent('editable=true');
  });

  it('marks cards read-only when the user cannot edit and honours showProfile=false', () => {
    render(<OrgProfileEditCards form={form} canEditOrg={false} showProfile={false} />);

    expect(screen.getByTestId('card-Organization')).toHaveTextContent('editable=false');
    expect(screen.getByTestId('card-Organization')).toHaveTextContent('showProfile=false');
    expect(screen.getByTestId('card-Address')).toHaveTextContent('editable=false');
  });

  it('falls back to sensible check-in defaults when the org has none', () => {
    const bareForm: OrgProfileForm = {
      ...form,
      formData: { name: 'Clinic', type: 'HOSPITAL', phoneNo: '1', taxId: 't' },
    };
    render(<OrgProfileEditCards form={bareForm} canEditOrg />);

    expect(screen.getByTestId('card-Check-in settings')).toBeInTheDocument();
  });
});
