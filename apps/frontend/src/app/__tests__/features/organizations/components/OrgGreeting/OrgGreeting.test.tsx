import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgGreeting, {
  getTimeGreeting,
} from '@/app/features/organizations/components/OrgGreeting/OrgGreeting';
import { useAuthStore } from '@/app/stores/authStore';

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockAuth = (attributes: Record<string, string> | null) => {
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ attributes }));
};

describe('getTimeGreeting', () => {
  it('returns morning before noon', () => {
    expect(getTimeGreeting(0)).toBe('Good morning');
    expect(getTimeGreeting(11)).toBe('Good morning');
  });

  it('returns afternoon between noon and 5pm', () => {
    expect(getTimeGreeting(12)).toBe('Good afternoon');
    expect(getTimeGreeting(16)).toBe('Good afternoon');
  });

  it('returns evening from 5pm onwards', () => {
    expect(getTimeGreeting(17)).toBe('Good evening');
    expect(getTimeGreeting(23)).toBe('Good evening');
  });
});

describe('OrgGreeting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('greets the user by first name and shows plural org count', () => {
    mockAuth({ given_name: 'Weber' });
    render(<OrgGreeting orgCount={3} />);

    expect(screen.getByText(/, Weber$/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Where are you working today?' })
    ).toBeInTheDocument();
    expect(screen.getByText('You belong to 3 organizations')).toBeInTheDocument();
  });

  it('uses singular wording for exactly one organization', () => {
    mockAuth({ given_name: 'Weber' });
    render(<OrgGreeting orgCount={1} />);
    expect(screen.getByText('You belong to 1 organization')).toBeInTheDocument();
  });

  it('omits the name when no given_name is present', () => {
    mockAuth(null);
    render(<OrgGreeting orgCount={0} />);

    const greeting = screen.getByText(/^Good (morning|afternoon|evening)$/);
    expect(greeting).toBeInTheDocument();
    expect(greeting.textContent).not.toContain(',');
    expect(screen.getByText('You belong to 0 organizations')).toBeInTheDocument();
  });
});
