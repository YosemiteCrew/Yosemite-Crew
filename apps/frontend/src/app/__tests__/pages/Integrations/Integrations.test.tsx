import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedIntegrations from '@/app/features/integrations/pages/Integrations';

const useIntegrationsForPrimaryOrgMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const loadIntegrationsForPrimaryOrgMock = jest.fn();
const getOrgIntegrationsMock = jest.fn();
const getIntegrationByProviderMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();
const storeIntegrationCredentialsMock = jest.fn();
const validateIntegrationCredentialsMock = jest.fn();
const enableIntegrationMock = jest.fn();
const disableIntegrationMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: jest.fn(() => ({ name: 'Pet Org' })),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  loadIntegrationsForPrimaryOrg: (...args: any[]) => loadIntegrationsForPrimaryOrgMock(...args),
  useIntegrationsForPrimaryOrg: () => useIntegrationsForPrimaryOrgMock(),
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/stores/integrationStore', () => ({
  useIntegrationStore: (selector: any) =>
    selector({
      status: 'loaded',
      error: null,
      lastFetchedAt: null,
      getIntegrationByProvider: () => null,
    }),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inname, value, onChange }: any) => (
    <input data-testid={inname} value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/FormInputPass/FormInputPass', () => ({
  __esModule: true,
  default: ({ inname, value, onChange }: any) => (
    <input data-testid={inname} value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getOrgIntegrations: (...args: any[]) => getOrgIntegrationsMock(...args),
  getIntegrationByProvider: (...args: any[]) => getIntegrationByProviderMock(...args),
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
  storeIntegrationCredentials: (...args: any[]) => storeIntegrationCredentialsMock(...args),
  validateIntegrationCredentials: (...args: any[]) => validateIntegrationCredentialsMock(...args),
  enableIntegration: (...args: any[]) => enableIntegrationMock(...args),
  disableIntegration: (...args: any[]) => disableIntegrationMock(...args),
}));

describe('Integrations settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const enabledIntegration = {
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'enabled',
      enabledAt: '2026-01-12T00:00:00.000Z',
      credentialsStatus: 'valid',
      lastValidatedAt: '2026-01-12T00:00:00.000Z',
    };
    getOrgIntegrationsMock.mockResolvedValue([]);
    getIntegrationByProviderMock.mockResolvedValue(enabledIntegration);
    useIntegrationsForPrimaryOrgMock.mockReturnValue([enabledIntegration]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(enabledIntegration);
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [] });
    loadIntegrationsForPrimaryOrgMock.mockResolvedValue(undefined);
    storeIntegrationCredentialsMock.mockResolvedValue({
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'enabled',
    });
    validateIntegrationCredentialsMock.mockResolvedValue({ ok: true });
    enableIntegrationMock.mockResolvedValue({
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'enabled',
    });
    disableIntegrationMock.mockResolvedValue({
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'disabled',
    });
  });

  it('stores credentials from settings modal', async () => {
    render(<ProtectedIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('IDEXX')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: 'user-a' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });
    fireEvent.click(screen.getByRole('button', { name: /Store credentials|Update credentials/ }));

    await waitFor(() => {
      expect(storeIntegrationCredentialsMock).toHaveBeenCalledWith(
        'org-1',
        {
          credentials: {
            username: 'user-a',
            password: 'pass-a',
          },
        },
        'IDEXX'
      );
    });
  });

  it('respects disconnect confirmation and avoids disable on cancel', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ProtectedIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('IDEXX')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disable IDEXX' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(disableIntegrationMock).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows Enable on card when disabled and blocks enable if credentials are invalid', async () => {
    const disabledIntegration = {
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'disabled',
      credentialsStatus: 'invalid',
      enabledAt: null,
      lastValidatedAt: null,
    };
    useIntegrationsForPrimaryOrgMock.mockReturnValue([disabledIntegration]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(disabledIntegration);
    validateIntegrationCredentialsMock.mockRejectedValue(new Error('missing credentials'));

    render(<ProtectedIntegrations />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const enableInSettingsButton = await screen.findByRole('button', { name: 'Enable IDEXX' });
    expect(enableInSettingsButton).not.toBeDisabled();
    fireEvent.click(enableInSettingsButton);

    await waitFor(() => {
      expect(validateIntegrationCredentialsMock).toHaveBeenCalledWith('org-1', 'IDEXX');
      expect(enableIntegrationMock).not.toHaveBeenCalled();
    });

    expect(
      screen.getByText(
        'IDEXX credentials are missing or invalid. Open settings, fill credentials, validate, and then enable.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Integration settings')).toBeInTheDocument();
  });
});
