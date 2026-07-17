import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
// jest.mock calls below are hoisted above this import, so the component loads with mocked deps.
import ProtectedIntegrations from '@/app/features/integrations/pages/Integrations';

// ---------------------------------------------------------------------------
// Mock handles (declared before jest.mock factories, mirroring the established
// convention in the sibling Integrations.test.tsx).
// ---------------------------------------------------------------------------
const loadIntegrationsForPrimaryOrgMock = jest.fn();
const useIntegrationsForPrimaryOrgMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const usePrimaryOrgMock = jest.fn();
const usePrimaryOrgIdMock = jest.fn();
const useResolvedMerckMock = jest.fn();
const refreshMerckIntegrationMock = jest.fn();
const integrationStatusMock = jest.fn();
const integrationErrorMock = jest.fn();
const integrationLastFetchedAtMock = jest.fn();
const getIntegrationByProviderStateMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();
const storeIntegrationCredentialsMock = jest.fn();
const validateIntegrationCredentialsMock = jest.fn();
const enableIntegrationMock = jest.fn();
const disableIntegrationMock = jest.fn();
const getMerckGatewayMock = jest.fn();
const enableMerckMock = jest.fn();
const disableMerckMock = jest.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('next/image', () => ({
  __esModule: true,
  // Render as <img> (alt is an attribute, not text content) so card titles that
  // match their logo alt (e.g. "MSD Veterinary Manual") stay uniquely queryable.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: any) => <img alt={alt || ''} data-testid="mock-next-image" />,
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

jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="page-skeleton" />,
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: usePrimaryOrgIdMock() }),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  loadIntegrationsForPrimaryOrg: (...args: any[]) => loadIntegrationsForPrimaryOrgMock(...args),
  useIntegrationsForPrimaryOrg: () => useIntegrationsForPrimaryOrgMock(),
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: () => useResolvedMerckMock(),
}));

jest.mock('@/app/stores/integrationStore', () => {
  const build = () => ({
    status: integrationStatusMock(),
    error: integrationErrorMock(),
    lastFetchedAt: integrationLastFetchedAtMock(),
    getIntegrationByProvider: getIntegrationByProviderStateMock,
  });
  const useIntegrationStore: any = (selector: any) => selector(build());
  useIntegrationStore.getState = () => build();
  return { useIntegrationStore };
});

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="settings-modal">{children}</div> : null,
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
  Primary: ({ text, onClick, isDisabled, href }: any) => (
    <button type="button" data-href={href} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled, href }: any) => (
    <button type="button" data-href={href} onClick={onClick} disabled={isDisabled}>
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

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
  storeIntegrationCredentials: (...args: any[]) => storeIntegrationCredentialsMock(...args),
  validateIntegrationCredentials: (...args: any[]) => validateIntegrationCredentialsMock(...args),
  enableIntegration: (...args: any[]) => enableIntegrationMock(...args),
  disableIntegration: (...args: any[]) => disableIntegrationMock(...args),
}));

jest.mock('@/app/features/integrations/services/merckService', () => ({
  getMerckGateway: (...args: any[]) => getMerckGatewayMock(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------
const makeDisabledIdexx = (over: any = {}) => ({
  provider: 'IDEXX',
  organisationId: 'org-1',
  status: 'disabled',
  credentialsStatus: 'missing',
  enabledAt: null,
  lastValidatedAt: null,
  lastSyncAt: null,
  ...over,
});

const makeEnabledIdexx = (over: any = {}) => ({
  provider: 'IDEXX',
  organisationId: 'org-1',
  status: 'enabled',
  credentialsStatus: 'valid',
  enabledAt: '2026-01-12T10:00:00Z',
  lastValidatedAt: '2026-01-12T10:00:00Z',
  lastSyncAt: '2026-01-12T09:00:00Z',
  ...over,
});

const merckDisabled = () => ({
  integration: { provider: 'MERCK_MANUALS', status: 'disabled' },
  isEnabled: false,
  refresh: refreshMerckIntegrationMock,
});

const merckEnabled = () => ({
  integration: { provider: 'MERCK_MANUALS', status: 'enabled' },
  isEnabled: true,
  refresh: refreshMerckIntegrationMock,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const renderPage = () => render(<ProtectedIntegrations />);

// Anchor the "page rendered" wait on the unique subtitle to safely flush the
// mount effects before assertions/interactions.
const waitForPage = () =>
  screen.findByText('Connect labs, references and devices to the workspace');

const openSettings = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manage credentials' }));
  return screen.findByTestId('settings-modal');
};

// Resolve an integration card root from its (unique) title text.
const getCard = (title: string): HTMLElement => {
  const heading = screen.getByText(title);
  const card = heading.closest('div.w-full');
  if (!card) throw new Error(`card root not found for ${title}`);
  return card as HTMLElement;
};

beforeEach(() => {
  jest.clearAllMocks();
  usePrimaryOrgMock.mockReturnValue({ name: 'Pet Org' });
  usePrimaryOrgIdMock.mockReturnValue('org-1');
  useIntegrationsForPrimaryOrgMock.mockReturnValue([makeDisabledIdexx()]);
  useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeDisabledIdexx());
  useResolvedMerckMock.mockReturnValue(merckDisabled());
  integrationStatusMock.mockReturnValue('loaded');
  integrationErrorMock.mockReturnValue(null);
  integrationLastFetchedAtMock.mockReturnValue(null);
  getIntegrationByProviderStateMock.mockReturnValue(null);
  listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [] });
  storeIntegrationCredentialsMock.mockResolvedValue({ provider: 'IDEXX', status: 'disabled' });
  validateIntegrationCredentialsMock.mockResolvedValue({ ok: true });
  enableIntegrationMock.mockResolvedValue({ status: 'enabled' });
  disableIntegrationMock.mockResolvedValue({ status: 'disabled' });
  enableMerckMock.mockResolvedValue({ provider: 'MERCK_MANUALS', status: 'enabled' });
  disableMerckMock.mockResolvedValue({ provider: 'MERCK_MANUALS', status: 'disabled' });
  getMerckGatewayMock.mockReturnValue({
    enable: enableMerckMock,
    disable: disableMerckMock,
    getStatus: jest.fn(),
    search: jest.fn(),
  });
});

// ---------------------------------------------------------------------------
// Default (disabled) render
// ---------------------------------------------------------------------------
describe('IntegrationsPage — default disabled render', () => {
  it('renders header, all integration cards, zero active count and no error', async () => {
    renderPage();
    await waitForPage();

    expect(screen.getByRole('heading', { name: /Integrations/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Integrations info' })).toBeInTheDocument();
    expect(screen.getByText('Active integrations:')).toHaveTextContent('Active integrations: 0');

    // Every card is visible under the default "All" filter.
    expect(screen.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument();
    expect(screen.getByText('MSD Veterinary Manual')).toBeInTheDocument();
    expect(screen.getByText('RadAnalyzer')).toBeInTheDocument();
    expect(screen.getByText('Vetnio')).toBeInTheDocument();
    expect(screen.getByText('QuickBooks')).toBeInTheDocument();
    expect(screen.getByText('Laika')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(4);

    // Disabled → the "Enable" card button (not the trash quick action) is shown.
    expect(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Enable' })
    ).toBeInTheDocument();
    expect(
      within(getCard('MSD Veterinary Manual')).getByRole('button', { name: 'Enable' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Disable IDEXX quick action' })
    ).not.toBeInTheDocument();

    // Disabled status pill (no live dot branch).
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // "All" tab is active; the others are not.
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Connected' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('opens the settings modal showing store-credentials hint for a fresh integration', async () => {
    renderPage();
    await waitForPage();
    await openSettings();

    const modal = screen.getByTestId('settings-modal');
    expect(within(modal).getByText('Integration settings')).toBeInTheDocument();
    // hasStoredCredentials === false → "Store credentials" + connect hint + Enable IDEXX.
    expect(within(modal).getByRole('button', { name: 'Store credentials' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Enable IDEXX' })).toBeDisabled();
    expect(within(modal).getByText('Store credentials first to enable IDEXX.')).toBeInTheDocument();
    // credentialsStatus "missing" → neutral fallback token label + no validate meta yet.
    expect(within(modal).getByText('Missing')).toBeInTheDocument();
    expect(
      within(modal).queryByText('Credentials validated successfully.')
    ).not.toBeInTheDocument();
    // formatOptionalDate fallback branches.
    expect(within(modal).getByText('Not refreshed yet')).toBeInTheDocument();
    expect(
      within(modal).getByText('No linked IVLS devices found for this organization.')
    ).toBeInTheDocument();
  });

  it('closes the settings modal via the Close control', async () => {
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(
      within(screen.getByTestId('settings-modal')).getByRole('button', { name: 'close' })
    );
    await waitFor(() => expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Enabled render
// ---------------------------------------------------------------------------
describe('IntegrationsPage — enabled render', () => {
  beforeEach(() => {
    useIntegrationsForPrimaryOrgMock.mockReturnValue([
      makeEnabledIdexx(),
      { provider: 'OTHER', status: 'disabled' },
      { provider: 'NO_STATUS' }, // exercises integration.status?.toLowerCase() undefined branch
    ]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    useResolvedMerckMock.mockReturnValue(merckEnabled());
  });

  it('renders trash quick actions, workspace links, live pills and active count', async () => {
    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith('org-1'));

    expect(screen.getByText('Active integrations:')).toHaveTextContent('Active integrations: 2');
    expect(screen.getByRole('button', { name: 'Disable IDEXX quick action' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disable MSD Veterinary Manual' })
    ).toBeInTheDocument();
    expect(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Open workspace' })
    ).toBeInTheDocument();
    expect(
      within(getCard('MSD Veterinary Manual')).getByRole('button', { name: 'Open manuals' })
    ).toBeInTheDocument();
    // IDEXX reads as CONNECTED per the design; MSD keeps ENABLED.
    expect(within(getCard('IDEXX VetConnect PLUS')).getByText('Connected')).toBeInTheDocument();
    expect(within(getCard('MSD Veterinary Manual')).getByText('Enabled')).toBeInTheDocument();
    await flush();
  });

  it('reads the IDEXX action as a neutral "Open workspace" pill and shows the plugin hint', async () => {
    renderPage();
    await waitForPage();
    // Open workspace is the neutral outline (Secondary) pill, not the filled Enable CTA.
    expect(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Open workspace' })
    ).toBeInTheDocument();
    expect(
      within(getCard('IDEXX VetConnect PLUS')).queryByRole('button', { name: 'Enable' })
    ).not.toBeInTheDocument();
    // Developer-portal plugin hint row.
    expect(screen.getByText(/More integrations ship as plugins/i)).toBeInTheDocument();
    await flush();
  });

  it('renders the linked device list with both status/displayName/poll branches', async () => {
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        {
          deviceSerialNumber: 'SN-1',
          displayName: 'Analyzer One',
          vcpActivatedStatus: 'active',
          lastPolledCloudTime: '2026-01-11T08:00:00Z',
        },
        {
          deviceSerialNumber: 'SN-2',
          displayName: null,
          vcpActivatedStatus: '',
          lastPolledCloudTime: '',
        },
      ],
    });

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());
    await openSettings();

    const modal = screen.getByTestId('settings-modal');
    // hasStoredCredentials === true → "Update credentials" + enabled connection.
    expect(within(modal).getByRole('button', { name: 'Update credentials' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Disable IDEXX' })).toBeInTheDocument();
    expect(
      within(modal).getByText(/IDEXX is enabled\. Use the Credentials section/)
    ).toBeInTheDocument();
    // credentialsStatus "valid" → validateState valid meta.
    expect(within(modal).getByText('Credentials validated successfully.')).toBeInTheDocument();

    // DeviceCard branches.
    expect(within(modal).getByText('Analyzer One')).toBeInTheDocument();
    expect(within(modal).getByText('SN-1')).toBeInTheDocument();
    expect(within(modal).getByText('Active')).toBeInTheDocument();
    expect(within(modal).getByText('IVLS device')).toBeInTheDocument(); // null displayName fallback
    expect(within(modal).getByText('SN-2')).toBeInTheDocument();
    expect(within(modal).getByText('Unknown')).toBeInTheDocument(); // '' vcpActivatedStatus fallback
    expect(within(modal).getAllByText('Not available').length).toBeGreaterThanOrEqual(1);
    await flush();
  });

  it('shows the empty-device message when no IVLS devices are linked', async () => {
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [] });
    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());
    await openSettings();

    expect(
      within(screen.getByTestId('settings-modal')).getByText(
        'No linked IVLS devices found for this organization.'
      )
    ).toBeInTheDocument();
    await flush();
  });

  it('sets an error when loading linked devices fails on mount', async () => {
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitForPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load linked IDEXX devices.');
    await flush();
  });
});

// ---------------------------------------------------------------------------
// Store / validate credentials
// ---------------------------------------------------------------------------
describe('IntegrationsPage — credential handlers', () => {
  it('stores credentials with trimmed username and raw password', async () => {
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: '  user-a  ' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store credentials' }));

    await waitFor(() =>
      expect(storeIntegrationCredentialsMock).toHaveBeenCalledWith(
        'org-1',
        { credentials: { username: 'user-a', password: 'pass-a' } },
        'IDEXX'
      )
    );
    await waitFor(() =>
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true })
    );
    await flush();
  });

  it('surfaces an error when storing credentials fails', async () => {
    storeIntegrationCredentialsMock.mockRejectedValue(new Error('nope'));
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: 'user-a' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store credentials' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to store IDEXX credentials. Please verify and retry.');
    await flush();
  });

  it('shows saving-state labels while a store request is in flight', async () => {
    const deferred = createDeferred<any>();
    storeIntegrationCredentialsMock.mockReturnValue(deferred.promise);

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: 'user-a' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store credentials' }));

    // hasStoredCredentials false → "Saving...", validate → "Validating...", enable → "Updating..."
    await screen.findByRole('button', { name: 'Saving...' });
    expect(screen.getByRole('button', { name: 'Validating...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Updating...' })).toBeInTheDocument();

    await act(async () => {
      deferred.resolve({});
    });
    await waitFor(() => expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalled());
    await flush();
  });

  it('shows the "Updating..." label while updating existing credentials', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'valid' })
    );
    const deferred = createDeferred<any>();
    storeIntegrationCredentialsMock.mockReturnValue(deferred.promise);

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: 'user-a' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update credentials' }));

    // Both the credentials button and the enable button read "Updating..." while saving.
    const updatingButtons = await screen.findAllByRole('button', { name: 'Updating...' });
    expect(updatingButtons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      deferred.resolve({});
    });
    await waitFor(() => expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalled());
    await flush();
  });

  it('marks validation successful when validate resolves ok', async () => {
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('Credentials validated successfully.');
    await waitFor(() =>
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true })
    );
    await flush();
  });

  it('marks validation invalid when validate resolves not-ok', async () => {
    validateIntegrationCredentialsMock.mockResolvedValue({ ok: false });
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('Credentials are invalid or not available.');
    await flush();
  });

  it('marks validation invalid and errors when validate rejects', async () => {
    validateIntegrationCredentialsMock.mockRejectedValue(new Error('bad'));
    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('Credentials are invalid or not available.');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Credential validation failed.');
    await flush();
  });
});

// ---------------------------------------------------------------------------
// Enable / disable IDEXX
// ---------------------------------------------------------------------------
describe('IntegrationsPage — enable/disable IDEXX', () => {
  it('enables IDEXX and loads devices when validation passes', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'valid' })
    );
    enableIntegrationMock.mockResolvedValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [] });

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Enable IDEXX' }));

    await waitFor(() =>
      expect(validateIntegrationCredentialsMock).toHaveBeenCalledWith('org-1', 'IDEXX')
    );
    await waitFor(() => expect(enableIntegrationMock).toHaveBeenCalledWith('org-1', 'IDEXX'));
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith('org-1'));
    await screen.findByRole('button', { name: 'Enable IDEXX' });
    await flush();
  });

  it('does not load devices when enable resolves to a non-enabled status', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'valid' })
    );
    enableIntegrationMock.mockResolvedValue({ status: 'disabled' });

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Enable IDEXX' }));

    await waitFor(() => expect(enableIntegrationMock).toHaveBeenCalledWith('org-1', 'IDEXX'));
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Enable IDEXX' });
    await flush();
  });

  it('blocks enable and opens settings when validation fails', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'invalid' })
    );
    validateIntegrationCredentialsMock.mockRejectedValue(new Error('missing creds'));

    renderPage();
    await waitForPage();

    // Enable directly from the card (isDisabled=saving only).
    fireEvent.click(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Enable' })
    );

    await waitFor(() =>
      expect(validateIntegrationCredentialsMock).toHaveBeenCalledWith('org-1', 'IDEXX')
    );
    expect(enableIntegrationMock).not.toHaveBeenCalled();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'IDEXX credentials are missing or invalid. Open settings, fill credentials, validate, and then enable.'
    );
    // setShowSettings(true) opened the modal.
    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument();
    await flush();
  });

  it('shows the card "Enabling..." label while enabling is in flight', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'valid' })
    );
    const deferred = createDeferred<any>();
    validateIntegrationCredentialsMock.mockReturnValue(deferred.promise);

    renderPage();
    await waitForPage();

    const idexxCard = getCard('IDEXX VetConnect PLUS');
    fireEvent.click(within(idexxCard).getByRole('button', { name: 'Enable' }));

    await within(idexxCard).findByRole('button', { name: 'Enabling...' });

    await act(async () => {
      deferred.resolve({ ok: true });
    });
    await waitFor(() => expect(enableIntegrationMock).toHaveBeenCalledWith('org-1', 'IDEXX'));
    await within(getCard('IDEXX VetConnect PLUS')).findByRole('button', { name: 'Enable' });
    await flush();
  });

  it('prompts to store credentials when enabling with no integration record', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(null);
    renderPage();
    await waitForPage();

    fireEvent.click(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Enable' })
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Store IDEXX credentials in settings before enabling.');
    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument();
    expect(enableIntegrationMock).not.toHaveBeenCalled();
    await flush();
  });

  it('disables IDEXX after confirmation from the trash quick action', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Disable IDEXX quick action' }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() => expect(disableIntegrationMock).toHaveBeenCalledWith('org-1', 'IDEXX'));
    await waitFor(() =>
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true })
    );
    await flush();
    confirmSpy.mockRestore();
  });

  it('does not disable IDEXX when the confirmation is cancelled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());
    await openSettings();

    fireEvent.click(
      within(screen.getByTestId('settings-modal')).getByRole('button', { name: 'Disable IDEXX' })
    );

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(disableIntegrationMock).not.toHaveBeenCalled();
    await flush();
    confirmSpy.mockRestore();
  });

  it('surfaces an error when disabling fails', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    disableIntegrationMock.mockRejectedValue(new Error('down'));
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Disable IDEXX quick action' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to update IDEXX integration status.');
    await flush();
    confirmSpy.mockRestore();
  });

  it('shows "Updating..." in the modal while a disable request is in flight', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    const deferred = createDeferred<any>();
    disableIntegrationMock.mockReturnValue(deferred.promise);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());
    await openSettings();

    fireEvent.click(
      within(screen.getByTestId('settings-modal')).getByRole('button', { name: 'Disable IDEXX' })
    );

    // getEnableDisableLabel(saving=true) → "Updating..." (both the enable/disable and the
    // "Update credentials" buttons read "Updating...") and getIdexxCardButtonLabel(true,true) → "Disabling..."
    const updatingButtons = await screen.findAllByRole('button', { name: 'Updating...' });
    expect(updatingButtons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      deferred.resolve({ status: 'disabled' });
    });
    await waitFor(() => expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Disable IDEXX' });
    await flush();
    confirmSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Manual refresh
// ---------------------------------------------------------------------------
describe('IntegrationsPage — manual refresh', () => {
  it('loads devices when the refreshed IDEXX becomes enabled', async () => {
    getIntegrationByProviderStateMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        {
          deviceSerialNumber: 'SN-9',
          displayName: 'Poller',
          vcpActivatedStatus: 'active',
          lastPolledCloudTime: '2026-01-11T08:00:00Z',
        },
      ],
    });

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh integrations' }));

    await waitFor(() =>
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true })
    );
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith('org-1'));
    await flush();
  });

  it('clears devices when the refreshed IDEXX is not enabled', async () => {
    getIntegrationByProviderStateMock.mockReturnValue(undefined); // exercises the ?? null branch

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh integrations' }));

    await waitFor(() => expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalled());
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
    await flush();
  });

  it('surfaces an error when the refresh fails', async () => {
    loadIntegrationsForPrimaryOrgMock.mockRejectedValue(new Error('offline'));

    renderPage();
    await waitForPage();
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh integrations' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to refresh integration status.');
    await flush();
  });
});

// ---------------------------------------------------------------------------
// Merck toggle
// ---------------------------------------------------------------------------
describe('IntegrationsPage — Merck toggle', () => {
  it('enables Merck via the gateway and refreshes', async () => {
    useResolvedMerckMock.mockReturnValue(merckDisabled());
    renderPage();
    await waitForPage();

    fireEvent.click(
      within(getCard('MSD Veterinary Manual')).getByRole('button', { name: 'Enable' })
    );

    await waitFor(() => expect(enableMerckMock).toHaveBeenCalledWith('org-1'));
    await waitFor(() =>
      expect(loadIntegrationsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true })
    );
    await flush();
  });

  it('disables Merck via the gateway and refreshes', async () => {
    useResolvedMerckMock.mockReturnValue(merckEnabled());
    renderPage();
    await waitForPage();

    fireEvent.click(screen.getByRole('button', { name: 'Disable MSD Veterinary Manual' }));

    await waitFor(() => expect(disableMerckMock).toHaveBeenCalledWith('org-1'));
    await flush();
  });

  it('surfaces an error when the Merck gateway fails', async () => {
    useResolvedMerckMock.mockReturnValue(merckDisabled());
    enableMerckMock.mockRejectedValue(new Error('gw'));
    renderPage();
    await waitForPage();

    fireEvent.click(
      within(getCard('MSD Veterinary Manual')).getByRole('button', { name: 'Enable' })
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to update MSD Veterinary Manual status.');
    await flush();
  });
});

// ---------------------------------------------------------------------------
// Filters & empty states
// ---------------------------------------------------------------------------
describe('IntegrationsPage — filters and empty states', () => {
  it('shows "No connected integrations yet." and hides all cards under Connected', async () => {
    // both providers disabled
    renderPage();
    await waitForPage();

    fireEvent.click(screen.getByRole('button', { name: 'Connected' }));
    await screen.findByText('No connected integrations yet.');

    expect(screen.getByRole('button', { name: 'Connected' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByText('IDEXX VetConnect PLUS')).not.toBeInTheDocument();
    expect(screen.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();
    expect(screen.queryByText('RadAnalyzer')).not.toBeInTheDocument();
    expect(screen.queryByText('QuickBooks')).not.toBeInTheDocument();
    await flush();
  });

  it('shows both connected cards under Connected when both are enabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    useResolvedMerckMock.mockReturnValue(merckEnabled());

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Connected' }));

    await waitFor(() => expect(screen.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument());
    expect(screen.getByText('MSD Veterinary Manual')).toBeInTheDocument();
    // coming-soon cards hidden under Connected
    expect(screen.queryByText('RadAnalyzer')).not.toBeInTheDocument();
    expect(screen.queryByText('No connected integrations yet.')).not.toBeInTheDocument();
    await flush();
  });

  it('shows IDEXX + coming-soon cards under Available when providers are not enabled', async () => {
    // IDEXX disabled, Merck enabled → IDEXX available, Merck hidden.
    useResolvedMerckMock.mockReturnValue(merckEnabled());

    renderPage();
    await waitForPage();

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));

    await waitFor(() => expect(screen.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument());
    expect(screen.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();
    expect(screen.getByText('RadAnalyzer')).toBeInTheDocument();
    await flush();
  });

  it('shows "No available integrations right now." under Available when both are enabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(makeEnabledIdexx());
    useResolvedMerckMock.mockReturnValue(merckEnabled());

    renderPage();
    await waitForPage();
    await waitFor(() => expect(listIdexxIvlsDevicesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    await screen.findByText('No available integrations right now.');

    // enabled provider cards hidden; coming-soon still visible under Available.
    expect(screen.queryByText('IDEXX VetConnect PLUS')).not.toBeInTheDocument();
    expect(screen.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();
    expect(screen.getByText('RadAnalyzer')).toBeInTheDocument();
    await flush();
  });

  it('suppresses empty-state output while the store is still loading', async () => {
    integrationStatusMock.mockReturnValue('loading');
    renderPage();
    await waitForPage();

    fireEvent.click(screen.getByRole('button', { name: 'Connected' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Connected' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
    // isReady === false → no "No connected integrations yet."
    expect(screen.queryByText('No connected integrations yet.')).not.toBeInTheDocument();
    await flush();
  });
});

// ---------------------------------------------------------------------------
// Store error propagation, unknown tokens, missing org
// ---------------------------------------------------------------------------
describe('IntegrationsPage — misc branches', () => {
  it('propagates an integration store error into the page alert', async () => {
    integrationErrorMock.mockReturnValue('Store level failure');
    renderPage();
    await waitForPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Store level failure');
    await flush();
  });

  it('renders fallback pill and credential tokens for unknown status values', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ status: 'connecting', credentialsStatus: 'expired' })
    );
    renderPage();
    await waitForPage();

    // StatusPill fallback branch (status not in statusTokens map) → "Connecting" label.
    expect(screen.getAllByText('Connecting').length).toBeGreaterThanOrEqual(1);

    await openSettings();
    const modal = screen.getByTestId('settings-modal');
    // credentialsStatusTokens fallback branch (unknown key) → "Expired" label rendered.
    expect(within(modal).getByText('Expired')).toBeInTheDocument();
    // resolveValidateState('expired') → 'idle' → no validate meta.
    expect(
      within(modal).queryByText('Credentials validated successfully.')
    ).not.toBeInTheDocument();
    await flush();
  });

  it('treats stored credentials as present via lastValidatedAt even when status is missing', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'missing', lastValidatedAt: '2026-01-01T00:00:00Z' })
    );
    renderPage();
    await waitForPage();
    await openSettings();

    const modal = screen.getByTestId('settings-modal');
    expect(
      within(modal).getByText('Stored credentials detected. Validate and enable when ready.')
    ).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Update credentials' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Enable IDEXX' })).not.toBeDisabled();
    await flush();
  });

  it('short-circuits every action handler when there is no primary org', async () => {
    usePrimaryOrgIdMock.mockReturnValue(null);
    usePrimaryOrgMock.mockReturnValue(null); // tooltip "?? your organization" branch
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(
      makeDisabledIdexx({ credentialsStatus: 'missing' })
    );

    renderPage();
    await waitForPage();
    await openSettings();

    // Fill credentials so the Store button is enabled and reaches its org guard.
    fireEvent.change(screen.getByTestId('idexx-username'), { target: { value: 'user-a' } });
    fireEvent.change(screen.getByTestId('idexx-password'), { target: { value: 'pass-a' } });

    fireEvent.click(screen.getByRole('button', { name: 'Store credentials' }));
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh integrations' }));
    // Card enable buttons are gated on saving only, so they reach the org guard.
    fireEvent.click(
      within(getCard('IDEXX VetConnect PLUS')).getByRole('button', { name: 'Enable' })
    );
    fireEvent.click(
      within(getCard('MSD Veterinary Manual')).getByRole('button', { name: 'Enable' })
    );

    await flush();

    expect(storeIntegrationCredentialsMock).not.toHaveBeenCalled();
    expect(validateIntegrationCredentialsMock).not.toHaveBeenCalled();
    expect(loadIntegrationsForPrimaryOrgMock).not.toHaveBeenCalled();
    expect(enableIntegrationMock).not.toHaveBeenCalled();
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
    expect(getMerckGatewayMock).not.toHaveBeenCalled();
  });
});
