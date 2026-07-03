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

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

const mockCreateOrg = jest.fn();
const mockUpdateOrg = jest.fn();

jest.mock('@/app/features/organization/services/orgService', () => ({
  createOrg: (...args: unknown[]) => mockCreateOrg(...args),
  updateOrg: (...args: unknown[]) => mockUpdateOrg(...args),
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
    mockCreateOrg.mockReset();
    mockUpdateOrg.mockReset();
  });

  test('renders initial step with progress component', () => {
    render(<ProtectedCreateOrg />);

    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create organization' })
    ).toBeInTheDocument();
    expect(screen.getByText('Create organization')).toBeInTheDocument();
    expect(screen.getByTestId('create-org-progress')).toBeInTheDocument();
    expect(latestProgressProps?.steps).toHaveLength(2);
    expect(latestProgressProps?.canSelectStep(0)).toBe(true);
    expect(latestProgressProps?.canSelectStep(1)).toBe(false);
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
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });
    expect(latestProgressProps?.steps).toHaveLength(2);
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
      latestProgressProps.onStepSelect(1);
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

  test('renders the address step as the final create org step', async () => {
    mockUseOrgOnboardingResult.step = 1;
    const { container } = render(<ProtectedCreateOrg />);
    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    expect(container.querySelector('.create-org-wrapper')).not.toHaveClass('invisible');
  });

  test('submits a new organization with create button and redirects to dashboard', async () => {
    mockUseOrgOnboardingResult.step = 1;
    mockCreateOrg.mockResolvedValue('org-new');
    render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
      expect(latestAddressStepProps.submitText).toBe('Create');
    });

    act(() => {
      latestAddressStepProps.setFormData({
        ...latestAddressStepProps.formData,
        address: {
          ...latestAddressStepProps.formData.address,
          addressLine: '1 Main St',
          city: 'Yosemite Valley',
          state: 'CA',
          postalCode: '95389',
          country: 'United States',
        },
      });
    });

    act(() => {
      latestAddressStepProps.onSubmit();
    });

    await waitFor(() => {
      expect(mockCreateOrg).toHaveBeenCalledTimes(1);
      expect(mockUpdateOrg).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('updates an existing organization with create button and redirects to dashboard', async () => {
    mockUseOrgOnboardingResult.org = {
      _id: 'org-1',
      name: 'Existing Org',
      taxId: 'TAX-1',
      phoneNo: '1234567890',
      address: {
        addressLine: '123 Old Rd',
        city: 'Old City',
        state: 'CA',
        postalCode: '90210',
        country: 'United States',
      },
    } as any;
    mockUseOrgOnboardingResult.step = 1;
    mockUpdateOrg.mockResolvedValue(undefined);
    render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
      expect(latestAddressStepProps.submitText).toBe('Save');
    });

    act(() => {
      latestAddressStepProps.onSubmit();
    });

    await waitFor(() => {
      expect(mockUpdateOrg).toHaveBeenCalledTimes(1);
      expect(mockCreateOrg).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
