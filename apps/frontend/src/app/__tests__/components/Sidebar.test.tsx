import React from 'react';
import { render, screen } from '@testing-library/react';
import Sidebar from '@/app/ui/layout/Sidebar/Sidebar';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgList, usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useSignOut } from '@/app/hooks/useAuth';

const mockUsePathname = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockRouter,
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span>{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('next/link', () => {
  const MockLink = ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockNextLink';
  return MockLink;
});

jest.mock('@/app/hooks/useAuth', () => ({
  useSignOut: jest.fn(),
}));
jest.mock('@/app/hooks/useOrgSelectors', () => ({
  useOrgList: jest.fn(),
  usePrimaryOrg: jest.fn(),
}));
jest.mock('@/app/hooks/useLoadOrg', () => ({ useLoadOrg: jest.fn() }));
jest.mock('@/app/hooks/useProfiles', () => ({ useLoadProfiles: jest.fn() }));
jest.mock('@/app/hooks/useAvailabiities', () => ({ useLoadAvailabilities: jest.fn() }));
jest.mock('@/app/hooks/useSpecialities', () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseOrgList = useOrgList as unknown as jest.Mock;
const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;
const mockUseSignOut = useSignOut as unknown as jest.Mock;

const setPrimaryOrg = jest.fn();

const setupOrgStore = (status: string = 'loaded') => {
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({
      status,
      setPrimaryOrg,
    })
  );
};

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUsePathname.mockReturnValue('/dashboard');
    mockUseSignOut.mockReturnValue({ signOut: jest.fn().mockResolvedValue(undefined) });
  });

  it('renders loading shell when orgs are still loading', () => {
    setupOrgStore('loading');
    mockUseOrgList.mockReturnValue([]);
    mockUsePrimaryOrg.mockReturnValue(null);

    const { container } = render(<Sidebar />);

    expect(container.querySelector('.sidebar')).toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('links the authenticated sidebar logo to the dashboard', () => {
    setupOrgStore('loaded');
    mockUseOrgList.mockReturnValue([]);
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Logo' })).toHaveAttribute('href', '/dashboard');
  });

  it('keeps the collapsed authenticated sidebar logo linked to the dashboard', () => {
    setupOrgStore('loaded');
    mockUseOrgList.mockReturnValue([]);
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });
    window.localStorage.setItem('yc_sidebar_collapsed', '1');

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Logo' })).toHaveAttribute('href', '/dashboard');
  });
});
