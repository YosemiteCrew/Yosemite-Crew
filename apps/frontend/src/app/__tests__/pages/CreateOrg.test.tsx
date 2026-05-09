import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Steps/Progress/Progress')) {
        const MockProgress = (
          jest.requireMock('@/app/features/onboarding/components/Steps/Progress/Progress') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockProgress {...props} />;
      }
      if (source.includes('Steps/CreateOrg/OrgStep')) {
        const MockOrgStep = (
          jest.requireMock('@/app/features/onboarding/components/Steps/CreateOrg/OrgStep') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockOrgStep {...props} />;
      }
      if (source.includes('Steps/CreateOrg/AddressStep')) {
        const MockAddressStep = (
          jest.requireMock('@/app/features/onboarding/components/Steps/CreateOrg/AddressStep') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockAddressStep {...props} />;
      }
      if (source.includes('Steps/CreateOrg/SpecialityStep')) {
        const MockSpecialityStep = (
          jest.requireMock(
            '@/app/features/onboarding/components/Steps/CreateOrg/SpecialityStep'
          ) as { default: React.FC<Record<string, unknown>> }
        ).default;
        return <MockSpecialityStep {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

let latestProgressProps: any;
jest.mock('@/app/features/onboarding/components/Steps/Progress/Progress', () => ({
  __esModule: true,
  default: (props: any) => {
    latestProgressProps = props;
    return <div data-testid="create-org-progress" />;
  },
}));

let latestOrgStepProps: any;
jest.mock('@/app/features/onboarding/components/Steps/CreateOrg/OrgStep', () => ({
  __esModule: true,
  default: (props: any) => {
    latestOrgStepProps = props;
    return <div data-testid="org-step" />;
  },
}));

let latestAddressStepProps: any;
jest.mock('@/app/features/onboarding/components/Steps/CreateOrg/AddressStep', () => ({
  __esModule: true,
  default: (props: any) => {
    latestAddressStepProps = props;
    return <div data-testid="address-step" />;
  },
}));

let latestSpecialityStepProps: any;
jest.mock('@/app/features/onboarding/components/Steps/CreateOrg/SpecialityStep', () => ({
  __esModule: true,
  default: (props: any) => {
    latestSpecialityStepProps = props;
    return <div data-testid="speciality-step" />;
  },
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

const mockUseOrgOnboardingResult = {
  org: null,
  step: 0,
  specialities: [] as any[],
  isReady: true,
};

jest.mock('@/app/hooks/useOrgOnboarding', () => ({
  useOrgOnboarding: () => mockUseOrgOnboardingResult,
}));

const mockRouter = { replace: jest.fn() };
const mockSearchParams = { get: () => null };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

import ProtectedCreateOrg from '@/app/features/onboarding/pages/CreateOrg/CreateOrg';

describe('CreateOrg page', () => {
  beforeEach(() => {
    mockUseOrgOnboardingResult.org = null;
    mockUseOrgOnboardingResult.step = 0;
    mockUseOrgOnboardingResult.specialities = [];
    mockUseOrgOnboardingResult.isReady = true;
    latestProgressProps = undefined;
    latestOrgStepProps = undefined;
    latestAddressStepProps = undefined;
    latestSpecialityStepProps = undefined;
  });

  test('renders initial step with progress component', () => {
    render(<ProtectedCreateOrg />);

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create organization' })
    ).toBeInTheDocument();
    expect(screen.getByText('Create organization')).toBeInTheDocument();
    expect(screen.getByTestId('create-org-progress')).toBeInTheDocument();
    expect(latestProgressProps?.steps).toHaveLength(3);
    expect(latestProgressProps?.canSelectStep(0)).toBe(true);
    expect(latestProgressProps?.canSelectStep(2)).toBe(false);
    expect(screen.getByTestId('org-step')).toBeInTheDocument();
  });

  test('advances through steps when nextStep is invoked', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestOrgStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    act(() => {
      latestAddressStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId('speciality-step')).toBeInTheDocument();
    });
    expect(latestSpecialityStepProps.specialities).toBeDefined();
    expect(Array.isArray(latestSpecialityStepProps.specialities)).toBe(true);
  });

  test('goes back to previous step when prevStep called', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestOrgStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    act(() => {
      latestAddressStepProps.prevStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId('org-step')).toBeInTheDocument();
    });
  });

  test('clicking a future progress step validates and keeps the user on the failing step', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('org-step')).toBeInTheDocument();
    });
  });

  test('clicking a completed progress step navigates back to it', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestOrgStepProps.nextStep();
    });
    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    act(() => {
      latestProgressProps.onStepSelect(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('org-step')).toBeInTheDocument();
    });
  });

  test('keeps create org content hidden while transitioning to profile setup', async () => {
    mockUseOrgOnboardingResult.step = 2;
    const { container } = render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('speciality-step')).toBeInTheDocument();
    });

    act(() => {
      latestSpecialityStepProps.onRedirectingChange(true);
    });

    await waitFor(() => {
      expect(container.querySelector('.create-org-wrapper')).toHaveClass('invisible');
      expect(container.querySelector('.create-org-wrapper')).toHaveClass('pointer-events-none');
    });
  });
});
