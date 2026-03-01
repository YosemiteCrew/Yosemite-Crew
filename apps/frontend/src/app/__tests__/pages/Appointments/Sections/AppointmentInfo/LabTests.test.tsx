import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabTests from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';

const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();
const listIdexxTestsMock = jest.fn();
const getIdexxCensusMock = jest.fn();
const listIdexxResultsMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const createIdexxLabOrderMock = jest.fn();

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
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

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, defaultOption, onSelect }: any) => (
    <select
      data-testid={placeholder}
      value={defaultOption ?? ''}
      onChange={(e) => onSelect({ value: e.target.value })}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('@/app/ui/inputs/SearchDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, query, setQuery }: any) => (
    <div>
      <input
        data-testid={`query-${placeholder}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="button" onClick={() => onSelect(options[0]?.value ?? '9126')}>
        Select {placeholder}
      </button>
    </div>
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

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getIdexxResultPdfBlob: jest.fn(),
  getIdexxOrderById: jest.fn(),
  addPatientToIdexxCensus: jest.fn(),
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
  listIdexxTests: (...args: any[]) => listIdexxTestsMock(...args),
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
  getIdexxCensus: (...args: any[]) => getIdexxCensusMock(...args),
  listIdexxResults: (...args: any[]) => listIdexxResultsMock(...args),
  createIdexxLabOrder: (...args: any[]) => createIdexxLabOrderMock(...args),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

describe('LabTests', () => {
  const appointment: any = {
    id: 'appt-1',
    companion: {
      id: 'patient-1',
      parent: { id: 'parent-1' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [] });
    listIdexxTestsMock.mockResolvedValue({
      tests: [{ _id: 't1', code: '9126', display: 'Chem Panel', type: 'TEST' }],
    });
    listIdexxOrdersMock.mockResolvedValue([]);
    getIdexxCensusMock.mockResolvedValue([]);
    listIdexxResultsMock.mockResolvedValue([]);
  });

  it('shows integration-disabled state', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(
        screen.getByText('IDEXX integration is not enabled for this organization.')
      ).toBeInTheDocument();
    });
  });

  it('creates an IDEXX order after selecting a test', async () => {
    const createdOrder = {
      _id: 'ord-1',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'CREATED',
      modality: 'REFERENCE_LAB',
      idexxOrderId: '100329789',
      tests: ['9126'],
    };
    createIdexxLabOrderMock.mockResolvedValue(createdOrder);
    listIdexxOrdersMock.mockResolvedValue([createdOrder]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Search IDEXX tests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create IDEXX order' }));

    await waitFor(() => {
      expect(createIdexxLabOrderMock).toHaveBeenCalledWith({
        organisationId: 'org-1',
        payload: expect.objectContaining({
          companionId: 'patient-1',
          appointmentId: 'appt-1',
          tests: ['9126'],
          modality: 'REFERENCE_LAB',
        }),
      });
    });

    expect(screen.getByText('Order 100329789')).toBeInTheDocument();
  });

  it('renders result cards and PDF action when results are available', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-1',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329789',
        tests: ['9126'],
      },
    ]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-db-1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: '100329789',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
        rawPayload: {
          categories: [
            {
              name: 'Chemistry',
              tests: [{ name: 'Glucose', result: '109' }],
            },
          ],
        },
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxResultsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Result 1')).toBeInTheDocument();
      expect(screen.getByText(/ID: result-1/)).toBeInTheDocument();
      expect(screen.getByText(/Glucose/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
  });

  it('does not render results when appointment has no mapped orders', async () => {
    listIdexxOrdersMock.mockResolvedValue([]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-db-1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: '100329789',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxResultsMock).not.toHaveBeenCalled();
    });

    expect(screen.queryByText('Result 1')).not.toBeInTheDocument();
  });

  it('marks meter marker red when value is outside range even without outOfRange flag', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-1',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329789',
        tests: ['9126'],
      },
    ]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-db-2',
        provider: 'IDEXX',
        resultId: 'result-2',
        orderId: '100329789',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
        rawPayload: {
          categories: [
            {
              name: 'Chemistry',
              tests: [{ name: 'ALT', result: '150', referenceRange: '10 - 100' }],
            },
          ],
        },
      },
    ]);

    const { container } = render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('ALT')).toBeInTheDocument();
    });

    expect(container.querySelector('div.bg-red-500')).toBeInTheDocument();
  });
});
