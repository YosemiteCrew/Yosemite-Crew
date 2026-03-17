import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedIdexxWorkspace from '@/app/features/integrations/pages/IdexxWorkspace';

const getIntegrationByProviderMock = jest.fn();
const listIdexxResultsMock = jest.fn();
const getIdexxCensusMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const getIdexxResultByIdMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();

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

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
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

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
  useAppointmentsForPrimaryOrg: jest.fn(() => [
    { id: 'appt-1', companion: { id: 'patient-1', name: 'Buddy' } },
  ]),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getIdexxResultPdfBlob: jest.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  getIntegrationByProvider: (...args: any[]) => getIntegrationByProviderMock(...args),
  listIdexxResults: (...args: any[]) => listIdexxResultsMock(...args),
  getIdexxCensus: (...args: any[]) => getIdexxCensusMock(...args),
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
  getIdexxOrderById: jest.fn(),
  getIdexxResultById: (...args: any[]) => getIdexxResultByIdMock(...args),
}));

describe('IDEXX Hub page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getIdexxCensusMock.mockResolvedValue([]);
    listIdexxOrdersMock.mockResolvedValue([]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
  });

  it('shows disabled state when IDEXX integration is disabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('IDEXX integration is currently disabled.')).toBeInTheDocument();
    });
  });

  it('shows details and pdf actions for results', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: 'order-1',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Details' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'PDF' }).length).toBeGreaterThan(0);
    });
  });

  it('opens result details modal and loads single-result payload', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: 'order-1',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    getIdexxResultByIdMock.mockResolvedValue({
      _id: 'r1',
      provider: 'IDEXX',
      resultId: 'result-1',
      orderId: 'order-1',
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
    });

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Details' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Result details')).toBeInTheDocument();
      expect(screen.getByText('Result ID: result-1')).toBeInTheDocument();
      expect(screen.getByText(/Glucose/)).toBeInTheDocument();
    });
  });

  it('shows appointment labs icon link when result order maps to appointment', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: '100329789',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-1',
        idexxOrderId: '100329789',
        appointmentId: 'appt-1',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(
        links.some((link) =>
          String(link.getAttribute('href')).includes(
            '/appointments?appointmentId=appt-1&open=labs&subLabel=idexx-labs'
          )
        )
      ).toBe(true);
    });
  });

  it('resolves appointment labs link from requisitionId when orderId is missing', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r2',
        provider: 'IDEXX',
        resultId: 'result-2',
        requisitionId: 'req-100',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-2',
        idexxOrderId: 'req-100',
        appointmentId: 'appt-1',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(
        links.some((link) =>
          String(link.getAttribute('href')).includes(
            '/appointments?appointmentId=appt-1&open=labs&subLabel=idexx-labs'
          )
        )
      ).toBe(true);
    });
  });

  it('shows IVLS device IDs in the census list', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 465,
        patient: {
          patientId: 'patient-1',
          name: 'Doggy',
        },
        veterinarian: 'Harshit Wandhare',
        ivls: [{ serialNumber: 'PTH999900000827', displayName: null }],
        confirmedBy: [],
        confirmed: false,
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('IVLS Device ID')).toBeInTheDocument();
      expect(screen.getByText('PTH999900000827')).toBeInTheDocument();
    });
  });
});
