import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LinkedMedicalDevices from '@/app/features/organization/pages/Organization/Sections/LinkedMedicalDevices';
import { loadIntegrationsForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { useIntegrationStore } from '@/app/stores/integrationStore';

const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();

let primaryOrgId: string | null = 'org-1';
let lastFetchedAt: number | null = null;

jest.mock('@/app/ui/primitives/Accordion/AccordionButton', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId }),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  loadIntegrationsForPrimaryOrg: jest.fn(),
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/stores/integrationStore', () => ({
  useIntegrationStore: Object.assign(
    jest.fn((selector: any) => selector({ lastFetchedAt, getIntegrationByProvider: () => null })),
    { getState: jest.fn(() => ({ getIntegrationByProvider: () => null })) }
  ),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
}));

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: () => '09:12',
}));

jest.mock('react-icons/io5', () => ({
  IoRefreshOutline: () => <span data-testid="icon-refresh" />,
  IoFlaskOutline: () => <span data-testid="icon-flask" />,
  IoWaterOutline: () => <span data-testid="icon-water" />,
  IoBeakerOutline: () => <span data-testid="icon-beaker" />,
}));

const device = (over: Partial<Record<string, unknown>> = {}) => ({
  deviceSerialNumber: 'CAT1-4402',
  displayName: 'Catalyst One',
  vcpActivatedStatus: 'active',
  lastPolledCloudTime: '2026-07-10T09:12:00.000Z',
  ...over,
});

describe('LinkedMedicalDevices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    lastFetchedAt = null;
    (useIntegrationStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ lastFetchedAt, getIntegrationByProvider: () => null })
    );
    (useIntegrationStore as any).getState.mockReturnValue({
      getIntegrationByProvider: () => null,
    });
  });

  it('renders an empty state and "not yet" poll when integration is disabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });

    render(<LinkedMedicalDevices />);

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
    expect(screen.getByText(/Last cloud poll not yet · no devices linked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open integrations' })).toBeInTheDocument();
  });

  it('renders online + idle devices with the right icons and health summary', async () => {
    lastFetchedAt = 1_752_138_720_000;
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        device(),
        device({
          deviceSerialNumber: 'PCD-2210',
          displayName: 'ProCyte Dx',
          vcpActivatedStatus: 'active',
        }),
        device({
          deviceSerialNumber: 'VLU-0917',
          displayName: 'VetLab UA',
          vcpActivatedStatus: 'idle',
          lastPolledCloudTime: '2026-07-07T09:12:00.000Z',
        }),
      ],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());
    expect(screen.getByText(/Last cloud poll 09:12 · 1 need attention/)).toBeInTheDocument();
    expect(screen.getAllByText('ONLINE')).toHaveLength(2);
    expect(screen.getByText(/IDLE · \d+ days/)).toBeInTheDocument();
    expect(screen.getByTestId('icon-water')).toBeInTheDocument();
    expect(screen.getByTestId('icon-beaker')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-flask').length).toBeGreaterThanOrEqual(1);
    expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith('org-1');
  });

  it('shows "all healthy" and a fallback device label when every device is online', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [device({ displayName: null })],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => expect(screen.getByText('IVLS device')).toBeInTheDocument());
    expect(screen.getByText(/· all healthy/)).toBeInTheDocument();
  });

  it('renders idle without a day suffix when poll time is missing or recent', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        device({
          deviceSerialNumber: 'NO-POLL',
          displayName: 'No Poll',
          vcpActivatedStatus: 'idle',
          lastPolledCloudTime: '',
        }),
        device({
          deviceSerialNumber: 'BAD-DATE',
          displayName: 'Bad Date',
          vcpActivatedStatus: 'idle',
          lastPolledCloudTime: 'not-a-date',
        }),
        device({
          deviceSerialNumber: 'RECENT',
          displayName: 'Recent',
          vcpActivatedStatus: 'idle',
          lastPolledCloudTime: new Date().toISOString(),
        }),
      ],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => expect(screen.getByText('No Poll')).toBeInTheDocument());
    expect(screen.getAllByText('IDLE')).toHaveLength(3);
  });

  it('surfaces an error and clears the list when the fetch rejects', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error('network'));

    render(<LinkedMedicalDevices />);

    await waitFor(() =>
      expect(screen.getByText('Unable to refresh linked IVLS devices.')).toBeInTheDocument()
    );
    expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument();
  });

  it('does nothing on effect or manual refresh when there is no primary org', async () => {
    primaryOrgId = null;
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });

    render(<LinkedMedicalDevices />);

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));
    expect(loadIntegrationsForPrimaryOrg).not.toHaveBeenCalled();
  });

  it('renders a singular day label for a device idle for one day', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        device({
          deviceSerialNumber: 'ONE-DAY',
          displayName: 'One Day',
          vcpActivatedStatus: 'idle',
          lastPolledCloudTime: new Date(Date.now() - 1.4 * 86_400_000).toISOString(),
        }),
      ],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => expect(screen.getByText('IDLE · 1 day')).toBeInTheDocument());
  });

  it('re-fetches devices on manual refresh when the integration is enabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [device()] });
    (loadIntegrationsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (useIntegrationStore as any).getState.mockReturnValue({
      getIntegrationByProvider: () => ({ status: 'enabled' }),
    });

    render(<LinkedMedicalDevices />);
    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));

    await waitFor(() => expect((useIntegrationStore as any).getState).toHaveBeenCalled());
    expect(listIdexxIvlsDevicesMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('clears devices on manual refresh when the integration is no longer enabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [device()] });
    (loadIntegrationsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (useIntegrationStore as any).getState.mockReturnValue({
      getIntegrationByProvider: () => ({ status: 'disabled' }),
    });

    render(<LinkedMedicalDevices />);
    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
  });

  it('surfaces an error when manual refresh rejects', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });
    (loadIntegrationsForPrimaryOrg as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<LinkedMedicalDevices />);
    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));

    await waitFor(() =>
      expect(screen.getByText('Unable to refresh integration/device status.')).toBeInTheDocument()
    );
  });

  it('treats a missing integration as disabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(null);

    render(<LinkedMedicalDevices />);

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
  });

  it('handles a device response with no device list', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({});

    render(<LinkedMedicalDevices />);

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
  });

  it('treats a device with no activation status as idle', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [device({ vcpActivatedStatus: undefined, lastPolledCloudTime: '' })],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());
    expect(screen.getByText('IDLE')).toBeInTheDocument();
  });

  it('clears devices on manual refresh when the integration disappears', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [device()] });
    (loadIntegrationsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (useIntegrationStore as any).getState.mockReturnValue({
      getIntegrationByProvider: () => null,
    });

    render(<LinkedMedicalDevices />);
    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
  });

  it('handles a manual-refresh device response with no device list', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock
      .mockResolvedValueOnce({ ivlsDeviceList: [device()] })
      .mockResolvedValueOnce({});
    (loadIntegrationsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (useIntegrationStore as any).getState.mockReturnValue({
      getIntegrationByProvider: () => ({ status: 'enabled' }),
    });

    render(<LinkedMedicalDevices />);
    await waitFor(() => expect(screen.getByText('Catalyst One')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh linked medical devices' }));

    await waitFor(() =>
      expect(screen.getByText('No linked IVLS devices found.')).toBeInTheDocument()
    );
  });
});
