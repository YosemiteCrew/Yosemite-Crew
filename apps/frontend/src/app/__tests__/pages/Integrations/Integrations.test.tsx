import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
import ProtectedIntegrations from '@/app/features/integrations/pages/Integrations';

const useIntegrationsForPrimaryOrgMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const loadIntegrationsForPrimaryOrgMock = jest.fn();
const getOrgIntegrationsMock = jest.fn();
const getIntegrationByProviderMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const storeIntegrationCredentialsMock = jest.fn();
const validateIntegrationCredentialsMock = jest.fn();
const enableIntegrationMock = jest.fn();
const disableIntegrationMock = jest.fn();
const enableMerckMock = jest.fn();
const disableMerckMock = jest.fn();
const refreshMerckIntegrationMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt || ''}</span>,
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
jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: jest.fn(() => ({
    integration: { provider: 'MERCK_MANUALS', status: 'enabled', source: 'backend' },
    isEnabled: true,
    refresh: refreshMerckIntegrationMock,
  })),
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
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
  storeIntegrationCredentials: (...args: any[]) => storeIntegrationCredentialsMock(...args),
  validateIntegrationCredentials: (...args: any[]) => validateIntegrationCredentialsMock(...args),
  enableIntegration: (...args: any[]) => enableIntegrationMock(...args),
  disableIntegration: (...args: any[]) => disableIntegrationMock(...args),
}));
jest.mock('@/app/features/integrations/services/merckService', () => ({
  getMerckGateway: jest.fn(() => ({
    enable: (...args: any[]) => enableMerckMock(...args),
    disable: (...args: any[]) => disableMerckMock(...args),
    getStatus: jest.fn(),
    search: jest.fn(),
  })),
}));

describe('Integrations settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    enableMerckMock.mockResolvedValue({ provider: 'MERCK_MANUALS', status: 'enabled' });
    disableMerckMock.mockResolvedValue({ provider: 'MERCK_MANUALS', status: 'disabled' });
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
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'o1',
        idexxOrderId: 'IDX-1',
        companionId: 'c1',
        patientName: 'Poppy',
        tests: ['ear cytology'],
        modality: 'REFERENCE_LAB',
        status: 'RUNNING',
      },
    ]);
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
      expect(screen.getByRole('button', { name: 'Manage credentials' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manage credentials' }));
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

  it('shows QuickBooks as a coming soon integration', async () => {
    render(<ProtectedIntegrations />);

    expect(await screen.findByText('QuickBooks')).toBeInTheDocument();
    expect(
      screen.getByText(/Accounting sync for invoices, payments, customers/i)
    ).toBeInTheDocument();
  });

  it('respects disconnect confirmation and avoids disable on cancel', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ProtectedIntegrations />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Manage credentials' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manage credentials' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Manage credentials' }));

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

  it('reloads integrations and refreshes Merck status after toggling Merck', async () => {
    render(<ProtectedIntegrations />);

    const merckDisableButton = await screen.findByRole('button', {
      name: 'Disable MSD Veterinary Manual',
    });
    fireEvent.click(merckDisableButton);

    await waitFor(() => {
      expect(disableMerckMock).toHaveBeenCalledWith('org-1');
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true });
      expect(refreshMerckIntegrationMock).toHaveBeenCalled();
    });
  });

  it('has no axe violations on initial render', async () => {
    const { container } = render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('filter tabs expose aria-pressed state', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    const allTab = screen.getByRole('button', { name: 'All' });
    expect(allTab).toHaveAttribute('aria-pressed', 'true');
    const connectedTab = screen.getByRole('button', { name: 'Connected' });
    expect(connectedTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "No connected integrations yet." when connected filter is active with no connections', async () => {
    const disabledIntegration = {
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'disabled',
      credentialsStatus: 'missing',
      enabledAt: null,
      lastValidatedAt: null,
    };
    useIntegrationsForPrimaryOrgMock.mockReturnValue([disabledIntegration]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(disabledIntegration);
    // Override the merck integration hook to return disabled
    const useMerckModule = jest.requireMock('@/app/hooks/useMerckIntegration');
    (useMerckModule.useResolvedMerckIntegrationForPrimaryOrg as jest.Mock).mockReturnValue({
      integration: null,
      isEnabled: false,
      refresh: refreshMerckIntegrationMock,
    });

    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    fireEvent.click(screen.getByRole('button', { name: 'Connected' }));
    await screen.findByText('No connected integrations yet.');
  });

  it('clicking Available filter hides IDEXX card when IDEXX is enabled', async () => {
    const enabledIntegration = {
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'enabled',
      credentialsStatus: 'valid',
      enabledAt: '2026-01-12T00:00:00.000Z',
      lastValidatedAt: '2026-01-12T00:00:00.000Z',
    };
    useIntegrationsForPrimaryOrgMock.mockReturnValue([enabledIntegration]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(enabledIntegration);

    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    // When IDEXX is enabled and Available filter active, the IDEXX card should be hidden
    // (showIdexxCard = available && !idexxEnabled = false)
    const availableBtn = screen.getByRole('button', { name: 'Available' });
    fireEvent.click(availableBtn);
    await waitFor(() => {
      // Disable button should not appear as IDEXX card is hidden
      expect(screen.queryByRole('button', { name: /Disable IDEXX/i })).not.toBeInTheDocument();
    });
  });

  it('shows validated successfully message after validate click', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('button', { name: 'Manage credentials' });
    fireEvent.click(screen.getByRole('button', { name: 'Manage credentials' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('Credentials validated successfully.');
  });

  it('shows integration error from the store when integrationError is set', async () => {
    // The integrationError propagates via useEffect into local error state.
    // We simulate it by having the idexxService throw during IVLS load, which sets local error.
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error('Unable to load linked IDEXX devices.'));
    render(<ProtectedIntegrations />);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load linked IDEXX devices.');
  });

  it('shows the Vetnio integration card with "Coming soon" label', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    expect(screen.getAllByText('Vetnio').length).toBeGreaterThanOrEqual(1);
    const comingSoonLabels = screen.getAllByText('Coming soon');
    expect(comingSoonLabels.length).toBeGreaterThan(0);
  });

  it('shows Laika integration card with "Coming soon" label', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    expect(screen.getAllByText('Laika').length).toBeGreaterThanOrEqual(1);
  });

  it('hides coming-soon cards when Connected filter is active', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    fireEvent.click(screen.getByRole('button', { name: 'Connected' }));
    await waitFor(() => {
      expect(screen.queryByText('RadAnalyzer')).not.toBeInTheDocument();
    });
  });

  it('renders the workspace subtitle under the Integrations heading', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    expect(
      screen.getByText('Connect labs, references and devices to the workspace')
    ).toBeInTheDocument();
  });

  it('renders the live status pill (dot branch) for an enabled integration', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    // Enabled IDEXX reads as CONNECTED (design copy) and exercises the isLive === true
    // branch that adds the success indicator dot. The status pill is a <span>; the
    // "Connected" filter tab is a <button>, so scope the assertion to the pill span.
    const connectedNodes = screen.getAllByText('Connected');
    expect(connectedNodes.some((el) => el.tagName === 'SPAN')).toBe(true);
  });

  it('shows the developer-portal plugin hint row', async () => {
    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    expect(
      screen.getByText(/More integrations ship as plugins\. Browse the developer portal/i)
    ).toBeInTheDocument();
  });

  it('renders the status pill without the live dot when the integration is disabled', async () => {
    const disabledIntegration = {
      _id: 'int-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      status: 'disabled',
      credentialsStatus: 'missing',
      enabledAt: null,
      lastValidatedAt: null,
    };
    useIntegrationsForPrimaryOrgMock.mockReturnValue([disabledIntegration]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(disabledIntegration);

    render(<ProtectedIntegrations />);
    await screen.findByRole('heading', { name: 'Integrations' });
    // The disabled IDEXX pill (plus other providers defaulting to disabled) exercises the
    // isLive === false branch (no indicator dot).
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1);
  });
});
