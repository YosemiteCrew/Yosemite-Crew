import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabTests from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import { useLabTests } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import type { LabOrder } from '@/app/features/integrations/services/types';

const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();
const listIdexxTestsMock = jest.fn();
const getIdexxCensusMock = jest.fn();
const listIdexxResultsMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const createIdexxLabOrderMock = jest.fn();
const addPatientToIdexxCensusMock = jest.fn();
const getIdexxOrderByIdMock = jest.fn();

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
  getIdexxOrderById: (...args: any[]) => getIdexxOrderByIdMock(...args),
  addPatientToIdexxCensus: (...args: any[]) => addPatientToIdexxCensusMock(...args),
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
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        { deviceSerialNumber: 'ivls-1', displayName: 'Catalyst One' },
        { deviceSerialNumber: 'ivls-2', displayName: 'ProCyte One' },
      ],
    });
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
      uiUrl: 'https://idexx.test/order',
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
          patientId: 'patient-1',
          appointmentId: 'appt-1',
          tests: ['9126'],
          modality: 'REFERENCE_LAB',
        }),
      });
    });

    expect(screen.getByText('Order 100329789')).toBeInTheDocument();
  });

  it('refreshes the appointment orders when the IDEXX iframe is closed', async () => {
    const createdOrder = {
      _id: 'ord-2',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'CREATED',
      modality: 'REFERENCE_LAB',
      idexxOrderId: '100329790',
      uiUrl: 'https://vetconnectplus.com/order',
      tests: ['9126'],
    };
    listIdexxOrdersMock.mockResolvedValue([createdOrder]);

    const { result } = renderHook(() => useLabTests(appointment));

    const initialOrderRequests = listIdexxOrdersMock.mock.calls.length;

    act(() => {
      result.current.openOrderIframe('order', 'CREATED', createdOrder as LabOrder);
    });

    await waitFor(() => {
      expect(result.current.showOrderIframe).toBe(true);
    });

    await act(async () => {
      result.current.closeOrderIframeManually();
    });

    await waitFor(() => {
      expect(result.current.showOrderIframe).toBe(false);
      expect(listIdexxOrdersMock.mock.calls.length).toBe(initialOrderRequests + 1);
    });
  });

  it('keeps a follow-up iframe open across polling updates', async () => {
    jest.useFakeTimers();
    try {
      const followupOrder = {
        _id: 'ord-followup',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329791',
        uiUrl: 'https://vetconnectplus.com/order',
        updatedAt: '2026-06-01T10:00:00Z',
        tests: ['9126'],
      };
      listIdexxOrdersMock.mockResolvedValue([followupOrder]);
      getIdexxOrderByIdMock.mockResolvedValue({
        ...followupOrder,
        updatedAt: '2026-06-01T10:10:00Z',
      });

      const { result } = renderHook(() => useLabTests(appointment));

      act(() => {
        result.current.openOrderIframe('followup', 'SUBMITTED', followupOrder as LabOrder);
      });

      await waitFor(() => {
        expect(result.current.showOrderIframe).toBe(true);
      });

      await act(async () => {
        jest.advanceTimersByTime(8000);
        await Promise.resolve();
      });

      expect(result.current.showOrderIframe).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('auto-closes a created order iframe after IDEXX submits the order', async () => {
    jest.useFakeTimers();
    try {
      const createdOrder = {
        _id: 'ord-created',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'CREATED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329792',
        uiUrl: 'https://vetconnectplus.com/order',
        tests: ['9126'],
      };
      listIdexxOrdersMock.mockResolvedValue([createdOrder]);
      getIdexxOrderByIdMock.mockResolvedValue({
        ...createdOrder,
        status: 'SUBMITTED',
        pdfUrl: 'https://vetconnectplus.com/ack.pdf',
      });

      const { result } = renderHook(() => useLabTests(appointment));

      act(() => {
        result.current.openOrderIframe('order', 'CREATED', createdOrder as LabOrder);
      });

      await waitFor(() => {
        expect(result.current.showOrderIframe).toBe(true);
      });

      await act(async () => {
        jest.advanceTimersByTime(8000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.showOrderIframe).toBe(false);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('auto-closes a follow-up iframe only when IDEXX creates a new order id', async () => {
    jest.useFakeTimers();
    try {
      const followupOrder = {
        _id: 'ord-followup',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329793',
        uiUrl: 'https://vetconnectplus.com/order',
        pdfUrl: 'https://vetconnectplus.com/ack-old.pdf',
        tests: ['9126'],
      };
      const newFollowupOrder = {
        ...followupOrder,
        _id: 'ord-followup-new',
        idexxOrderId: '100329794',
        pdfUrl: 'https://vetconnectplus.com/ack-new.pdf',
      };
      listIdexxOrdersMock
        .mockResolvedValueOnce([followupOrder])
        .mockResolvedValueOnce([newFollowupOrder, followupOrder]);
      getIdexxOrderByIdMock.mockResolvedValue(followupOrder);

      const { result } = renderHook(() => useLabTests(appointment));

      act(() => {
        result.current.openOrderIframe('followup', 'SUBMITTED', followupOrder as LabOrder);
      });

      await waitFor(() => {
        expect(result.current.showOrderIframe).toBe(true);
      });

      await act(async () => {
        jest.advanceTimersByTime(8000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.showOrderIframe).toBe(false);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses in-house flow for census only after selecting an IVLS device', async () => {
    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('Modality'), { target: { value: 'INHOUSE' } });

    expect(screen.queryByRole('button', { name: 'Create IDEXX order' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Select Search IDEXX tests' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('In-house census')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Current appointment state: Select an IVLS device/)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('Select IVLS device'), { target: { value: 'ivls-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to census' }));

    await waitFor(() => {
      expect(addPatientToIdexxCensusMock).toHaveBeenCalledWith({
        organisationId: 'org-1',
        payload: expect.objectContaining({
          patientId: 'patient-1',
          parentId: 'parent-1',
          ivls: ['ivls-1'],
        }),
      });
    });
  });

  it('shows selected device state when companion is already in census for in-house flow', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 1,
        patient: { patientId: 'patient-1', name: 'Buddy' },
        ivls: [{ serialNumber: 'ivls-1', displayName: 'Catalyst One' }],
        confirmedBy: ['ivls-1'],
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(getIdexxCensusMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('Modality'), { target: { value: 'INHOUSE' } });
    fireEvent.change(screen.getByTestId('Select IVLS device'), { target: { value: 'ivls-1' } });

    expect(
      screen.getByText('Companion census status: Already added to census')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/IVLS confirmation: Confirmed for selected device/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Census device ID: Catalyst One \(ivls-1\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/Current appointment state: Ready on selected IVLS device/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to census' })).not.toBeInTheDocument();
  });

  it('does not allow re-adding the companion when already present in census on another device', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 1,
        patient: { patientId: 'patient-1', name: 'Buddy' },
        ivls: [{ serialNumber: 'ivls-1', displayName: 'Catalyst One' }],
        confirmedBy: ['ivls-1'],
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(getIdexxCensusMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('Modality'), { target: { value: 'INHOUSE' } });
    fireEvent.change(screen.getByTestId('Select IVLS device'), { target: { value: 'ivls-2' } });

    expect(
      screen.getByText('Companion census status: Already added to census')
    ).toBeInTheDocument();
    expect(screen.getByText(/IVLS confirmation: Pending for selected device/)).toBeInTheDocument();
    expect(
      screen.getByText(/Current appointment state: Already in census under another device/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Companion already exists in IDEXX census. IDEXX only allows one census entry per patient./
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to census' })).not.toBeInTheDocument();
    expect(addPatientToIdexxCensusMock).not.toHaveBeenCalled();
  });

  it('shows selected device as added but pending when census has the device without confirmation', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 1,
        patient: { patientId: 'patient-1', name: 'Buddy' },
        ivls: [{ serialNumber: 'ivls-2', displayName: 'ProCyte One' }],
        confirmedBy: [],
        confirmed: false,
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(getIdexxCensusMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('Modality'), { target: { value: 'INHOUSE' } });
    fireEvent.change(screen.getByTestId('Select IVLS device'), { target: { value: 'ivls-2' } });

    expect(
      screen.getByText('Companion census status: Already added to census')
    ).toBeInTheDocument();
    expect(screen.getByText(/IVLS confirmation: Pending for selected device/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Current appointment state: Added to selected device census, awaiting IVLS confirmation/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to census' })).not.toBeInTheDocument();
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
      expect(listIdexxOrdersMock).toHaveBeenCalledWith({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        companionId: 'patient-1',
      });
    });

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

  it('disables IDEXX iframe and acknowledgment actions for unsafe order URLs', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-unsafe',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'CREATED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'unsafe-1',
        tests: ['9126'],
        uiUrl: 'javascript:alert(1)',
        pdfUrl: 'data:text/html,<script>alert(1)</script>',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order unsafe-1')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Acknowledgment PDF' })).toBeDisabled();
  });

  it('renders IDEXX iframe with strict referrer policy for safe order URLs', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-safe',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'CREATED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'safe-1',
        tests: ['9126'],
        uiUrl: 'https://integration.vetconnectplus.com/order/123',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order safe-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const iframe = await screen.findByTitle('IDEXX order UI');
    expect(iframe).toHaveAttribute('src', 'https://integration.vetconnectplus.com/order/123');
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  it('shows manual close guidance for follow-up iframe flows', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-safe-followup',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'safe-followup-1',
        tests: ['9126'],
        uiUrl: 'https://integration.vetconnectplus.com/order/followup',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order safe-followup-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Follow up' }));

    expect(await screen.findByText(/If IDEXX shows the order was submitted/i)).toBeInTheDocument();
  });
});
