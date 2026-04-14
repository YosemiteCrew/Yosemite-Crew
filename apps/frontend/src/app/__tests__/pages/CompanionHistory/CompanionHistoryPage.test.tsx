import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompanionHistoryPage from '@/app/features/companionHistory/pages/CompanionHistoryPage';

const pushMock = jest.fn();
const startRouteLoaderMock = jest.fn();
const searchGetMock = jest.fn();
const useCompanionsParentsForPrimaryOrgMock = jest.fn();
const useCompanionStoreMock = jest.fn();
const replaceCompanionTextMock = jest.fn((text: string) => text);

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: searchGetMock }),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected">{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Back
    </button>
  ),
}));

jest.mock('@/app/features/companionHistory/components/CompanionHistoryTimeline', () => ({
  __esModule: true,
  default: ({ companionId, showDocumentUpload }: any) => (
    <div data-testid="timeline">{`${companionId}-${String(showDocumentUpload)}`}</div>
  ),
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
  useCompanionsParentsForPrimaryOrg: () => useCompanionsParentsForPrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => replaceCompanionTextMock,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => '/safe-photo.jpg'),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: () => startRouteLoaderMock(),
}));

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (selector: (s: { status: string }) => unknown) =>
    useCompanionStoreMock(selector),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ testId }: any) => <div data-testid={testId}>Loading...</div>,
}));

describe('CompanionHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return null;
      if (key === 'source') return null;
      if (key === 'backTo') return null;
      return null;
    });
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([]);
    useCompanionStoreMock.mockImplementation((selector: (s: { status: string }) => unknown) =>
      selector({ status: 'loaded' })
    );
  });

  it('shows missing companion notice and uses fallback back path', () => {
    render(<CompanionHistoryPage />);

    expect(screen.getByText('Companion Overview')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Companion id is missing. Please open overview from Appointments or Companions.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('timeline')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/companions');
  });

  it('shows loader when companions are still loading', () => {
    useCompanionStoreMock.mockImplementation((selector: (s: { status: string }) => unknown) =>
      selector({ status: 'loading' })
    );

    render(<CompanionHistoryPage />);

    expect(screen.getByTestId('companions-history-loader')).toBeInTheDocument();
    expect(screen.queryByText('Companion Overview')).not.toBeInTheDocument();
  });

  it('renders timeline and companion summary when companion id is present', () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return null;
      return null;
    });
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c-1',
          name: 'Buddy',
          photoUrl: '/buddy.jpg',
          breed: 'Labrador',
          type: 'DOG',
        },
      },
    ]);

    render(<CompanionHistoryPage />);

    expect(screen.getByTestId('timeline')).toHaveTextContent('c-1-true');
    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Labrador / DOG')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });

  it('prefers safe backTo path and falls back for unsafe value', () => {
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return '/appointments/details';
      return null;
    });

    const { rerender } = render(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments/details');

    pushMock.mockClear();
    startRouteLoaderMock.mockClear();
    searchGetMock.mockImplementation((key: string) => {
      if (key === 'companionId') return 'c-1';
      if (key === 'source') return 'appointments';
      if (key === 'backTo') return 'https://evil.example';
      return null;
    });

    rerender(<CompanionHistoryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(startRouteLoaderMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments');
  });
});
