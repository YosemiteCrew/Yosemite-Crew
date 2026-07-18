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

// Validation is exercised in dedicated unit tests; here it is mocked so each
// branch of CreateOrg's step/validation flow can be driven deterministically.
const mockValidateOrgBasics = jest.fn();
const mockValidateOrgAddress = jest.fn();
jest.mock('@/app/lib/organizationOnboardingValidation', () => ({
  validateOrgBasics: (...args: unknown[]) => mockValidateOrgBasics(...args),
  validateOrgAddress: (...args: unknown[]) => mockValidateOrgAddress(...args),
}));

const mockFindPhoneData = jest.fn();
jest.mock('@/app/features/companions/components/AddCompanion/type', () => ({
  findPhoneData: (...args: unknown[]) => mockFindPhoneData(...args),
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
const mockRedirect = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

import ProtectedCreateOrg from '@/app/features/onboarding/pages/CreateOrg/CreateOrg';

const VALID_ORG = {
  _id: '',
  name: 'Valley Vet',
  taxId: 'TAX-99',
  phoneNo: '+15551234567',
  address: {
    addressLine: '1 Main St',
    city: 'Yosemite Valley',
    state: 'CA',
    postalCode: '95389',
    country: 'United States',
  },
};

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
    mockRouter.replace.mockReset();
    mockRedirect.mockReset();
    mockFindPhoneData.mockReset().mockReturnValue({
      localNumber: '5551234567',
      selectedCode: { dialCode: '+1', countryName: 'United States' },
    });
    // Default: every validation passes and echoes normalized data back.
    mockValidateOrgBasics
      .mockReset()
      .mockReturnValue({ errors: {}, normalizedData: { ...VALID_ORG } });
    mockValidateOrgAddress
      .mockReset()
      .mockReturnValue({ errors: {}, normalizedData: { ...VALID_ORG } });
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

  test('renders nothing and skips form setup while onboarding data is not ready', () => {
    mockUseOrgOnboardingResult.isReady = false;
    const { container } = render(<ProtectedCreateOrg />);

    expect(container.querySelector('.create-org-wrapper')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create organization' })).not.toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test('redirects to the dashboard when onboarding is already complete', () => {
    mockUseOrgOnboardingResult.step = 2;
    render(<ProtectedCreateOrg />);

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
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

  test('is a no-op when selecting the already-active step', () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(0);
    });

    expect(screen.getByTestId('org-step')).toBeInTheDocument();
    expect(mockValidateOrgBasics).not.toHaveBeenCalled();
  });

  test('clicking a future progress step keeps the user on the failing org step', async () => {
    mockValidateOrgBasics.mockReturnValue({
      errors: { name: 'Organisation name is required' },
      normalizedData: { ...VALID_ORG },
    });
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('org-step')).toBeInTheDocument();
    });
    expect(latestOrgStepProps.errors).toEqual({ name: 'Organisation name is required' });
  });

  test('clicking a future progress step advances when the org step is valid', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });
    expect(mockValidateOrgBasics).toHaveBeenCalled();
  });

  test('selecting the address-complete step keeps the user on address when validation fails', async () => {
    mockValidateOrgAddress.mockReturnValue({
      errors: { postalCode: 'Postal code is required' },
      normalizedData: { ...VALID_ORG },
    });
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });
    expect(mockValidateOrgAddress).toHaveBeenCalled();
    expect(latestAddressStepProps.errors).toEqual({ postalCode: 'Postal code is required' });
  });

  test('selecting the address-complete step advances past both steps when valid', async () => {
    render(<ProtectedCreateOrg />);

    act(() => {
      latestProgressProps.onStepSelect(2);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('org-step')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('address-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-org-progress')).toBeInTheDocument();
    expect(mockValidateOrgAddress).toHaveBeenCalled();
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

    await act(async () => {
      await latestAddressStepProps.onSubmit();
    });

    await waitFor(() => {
      expect(mockCreateOrg).toHaveBeenCalledTimes(1);
      expect(mockUpdateOrg).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('updates an existing organization with save button and redirects to dashboard', async () => {
    mockUseOrgOnboardingResult.org = { ...VALID_ORG, _id: 'org-1', name: 'Existing Org' } as any;
    mockUseOrgOnboardingResult.step = 1;
    mockUpdateOrg.mockResolvedValue(undefined);
    render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
      expect(latestAddressStepProps.submitText).toBe('Save');
    });

    await act(async () => {
      await latestAddressStepProps.onSubmit();
    });

    await waitFor(() => {
      expect(mockUpdateOrg).toHaveBeenCalledTimes(1);
      expect(mockCreateOrg).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('does not submit when the address step is invalid', async () => {
    mockUseOrgOnboardingResult.step = 1;
    mockValidateOrgAddress.mockReturnValue({
      errors: { city: 'City is required' },
      normalizedData: { ...VALID_ORG },
    });
    render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    await act(async () => {
      await latestAddressStepProps.onSubmit();
    });

    expect(mockCreateOrg).not.toHaveBeenCalled();
    expect(mockUpdateOrg).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('re-enables the form when the create request rejects', async () => {
    mockUseOrgOnboardingResult.step = 1;
    mockCreateOrg.mockRejectedValue(new Error('network error'));
    const { container } = render(<ProtectedCreateOrg />);

    await waitFor(() => {
      expect(screen.getByTestId('address-step')).toBeInTheDocument();
    });

    await act(async () => {
      await latestAddressStepProps.onSubmit();
    });

    await waitFor(() => {
      expect(mockCreateOrg).toHaveBeenCalledTimes(1);
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(container.querySelector('.create-org-wrapper')).not.toHaveClass('invisible');
  });
});
