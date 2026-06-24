import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Payment from '@/app/features/organization/pages/Organization/Sections/Payment';

const mockUseSubscriptionForPrimaryOrg = jest.fn();
const mockUseCounterForPrimaryOrg = jest.fn();

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => mockUseSubscriptionForPrimaryOrg(),
  useCounterForPrimaryOrg: () => mockUseCounterForPrimaryOrg(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Accordion/AccordionButton', () => ({
  __esModule: true,
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/ProfileCard', () => ({
  __esModule: true,
  default: ({ title, org }: { title: string; org: Record<string, unknown> }) => (
    <div>
      <h2>{title}</h2>
      <p>Plan: {String(org.plan)}</p>
      <p>Appointments: {String(org.appointments)}</p>
      <p>Tools: {String(org.obervationalTools)}</p>
      <p>Users: {String(org.members)}</p>
    </div>
  ),
}));

describe('Payment organization section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({ plan: 'free' });
    mockUseCounterForPrimaryOrg.mockReturnValue({
      appointmentsUsed: 2,
      freeAppointmentsLimit: 120,
      toolsUsed: 1,
      freeToolsLimit: 200,
      usersBillableCount: 3,
      freeUsersLimit: 10,
    });
  });

  it('renders current plan and usage limits', () => {
    render(<Payment />);

    expect(screen.getByText('Plan overview')).toBeInTheDocument();
    expect(screen.getByText('Plan: Free')).toBeInTheDocument();
    expect(screen.getByText('Appointments: 2 / 120')).toBeInTheDocument();
    expect(screen.getByText('Tools: 1 / 200')).toBeInTheDocument();
    expect(screen.getByText('Users: 3 / 10')).toBeInTheDocument();
  });
});
