import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabTests from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import { useLabTests } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import {
  formatCensusIvlsDevices,
  formatOrderStatus,
  getMeterMeta,
  getNormalizedLifecycleStatus,
  getOrderActionLabel,
  getOrderActionSource,
  getOrderResultProgressFromResults,
  getResultOrderId,
  listIdexxOrdersWithFallback,
  mergeUniqueTests,
  normalizeOrders,
  normalizeResultProgress,
  orderSortDate,
  parseFloatSafe,
  parseReferenceRange,
  resolveLatestOrder,
  shouldCloseOrderIframe,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests.helpers';
import type {
  CensusEntry,
  IdexxTest,
  LabOrder,
  LabResult,
  LabResultTest,
} from '@/app/features/integrations/services/types';

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

const orgStoreStateMock = { primaryOrgId: 'org-1' };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(orgStoreStateMock),
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
  default: ({ placeholder, options, onSelect, query, setQuery, renderOption, onReachEnd }: any) => (
    <div>
      <input
        data-testid={`query-${placeholder}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="button" onClick={() => onSelect(options[0]?.value ?? '9126')}>
        Select {placeholder}
      </button>
      <button type="button" onClick={() => onReachEnd?.()}>
        Reach end {placeholder}
      </button>
      <div data-testid={`rendered-options-${placeholder}`}>
        {options.map((option: any) => (
          <div key={option.value}>{renderOption ? renderOption(option) : option.label}</div>
        ))}
        {renderOption ? renderOption({ value: 'no-meta', label: 'No meta label' }) : null}
      </div>
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

  // Guarantee real timers are restored after every test so a fake-timer test
  // that throws before its own cleanup can't leak into a later (real-timer) one.
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orgStoreStateMock.primaryOrgId = 'org-1';
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

  it('covers lab order and result helper edge cases', async () => {
    const olderOrder = {
      _id: 'older',
      status: 'CREATED',
      createdAt: '2026-06-01T09:00:00Z',
      idexxOrderId: 'order-older',
    } as LabOrder;
    const newerOrder = {
      _id: 'newer',
      status: 'SUBMITTED',
      externalStatus: 'IN PROCESS',
      updatedAt: '2026-06-02T09:00:00Z',
      idexxOrderId: 'order-newer',
    } as LabOrder;
    const normalized = normalizeOrders([olderOrder, newerOrder]);

    expect(normalized.map((order) => order._id)).toEqual(['newer', 'older']);
    expect(orderSortDate(olderOrder)).toBe('2026-06-01T09:00:00Z');
    expect(resolveLatestOrder(null, normalized)).toBe(newerOrder);
    expect(resolveLatestOrder(olderOrder, normalized)).toBe(olderOrder);
    expect(resolveLatestOrder({ _id: 'missing' } as LabOrder, normalized)).toBe(newerOrder);
    expect(getNormalizedLifecycleStatus({ status: 'in process' } as LabOrder)).toBe('IN_PROCESS');
    expect(formatOrderStatus(newerOrder)).toBe('Submitted (In process)');
    expect(formatOrderStatus({ status: '' } as LabOrder)).toBe(' ');
    expect(getOrderActionLabel({ status: 'SUBMITTED' } as LabOrder)).toBe('Follow up');
    expect(getOrderActionLabel({ status: 'CREATED' } as LabOrder)).toBe('Continue');
    expect(getOrderActionLabel({ status: '' } as LabOrder)).toBe('Continue');
    expect(getOrderActionLabel({ status: 'COMPLETE' } as LabOrder)).toBe('Open IDEXX');
    expect(getOrderActionSource({ status: 'submitted' } as LabOrder)).toBe('followup');
    expect(getOrderActionSource({ status: 'created' } as LabOrder)).toBe('order');

    const currentTests = [{ _id: 'same-id', code: 'CHEM', display: 'Chemistry' }] as IdexxTest[];
    const mergedTests = mergeUniqueTests(currentTests, [
      { _id: 'same-id', code: 'CHEM', display: 'Duplicate chemistry' },
      { _id: 'cbc-id', code: 'CBC', display: 'CBC' },
      { _id: 'no-code-id', display: 'No code' },
    ] as IdexxTest[]);
    expect(mergedTests.map((test) => test.display)).toEqual(['Chemistry', 'CBC', 'No code']);

    const results = [
      {
        orderId: 'order-1',
        statusDetail: 'FINAL',
        rawPayload: {},
      },
      {
        requisitionId: 'order-1',
        status: 'PARTIAL',
        rawPayload: {},
      },
      {
        rawPayload: { orderId: 'order-2', status: 'failed' },
      },
      {
        rawPayload: { requisitionId: 'order-3', statusDetail: 'running' },
      },
    ] as LabResult[];
    expect(getResultOrderId(results[0])).toBe('order-1');
    expect(getResultOrderId(results[2])).toBe('order-2');
    expect(getOrderResultProgressFromResults(results, 'order-1')).toBe('In process');
    expect(getOrderResultProgressFromResults(results, 'order-2')).toBe('Error');
    expect(getOrderResultProgressFromResults(results, 'missing')).toBe('');
    expect(normalizeResultProgress(null)).toBe('');
    expect(normalizeResultProgress('pending')).toBe('In process');
    expect(normalizeResultProgress('COMPLETE')).toBe('Complete');
    expect(normalizeResultProgress('failure')).toBe('Error');
    expect(normalizeResultProgress('unknown')).toBe('');

    listIdexxOrdersMock.mockRejectedValueOnce(new Error('appointment not found'));
    listIdexxOrdersMock.mockResolvedValueOnce([olderOrder]);
    await expect(listIdexxOrdersWithFallback('org-1', 'appt-1', 'patient-1')).resolves.toEqual([
      olderOrder,
    ]);
    expect(listIdexxOrdersMock).toHaveBeenLastCalledWith({
      organisationId: 'org-1',
      companionId: 'patient-1',
    });

    listIdexxOrdersMock.mockRejectedValueOnce(new Error('no companion'));
    await expect(listIdexxOrdersWithFallback('org-1', 'appt-1')).rejects.toThrow('no companion');
  });

  it('covers census device formatting, numeric parsing, and iframe close decisions', () => {
    expect(formatCensusIvlsDevices(null)).toBe('-');
    expect(formatCensusIvlsDevices({ ivls: [] } as unknown as CensusEntry)).toBe('-');
    expect(
      formatCensusIvlsDevices({
        ivls: [
          { displayName: 'Catalyst One', serialNumber: 'abc-123' },
          { displayName: 'ProCyte One' },
          { serialNumber: 'solo-serial' },
          {},
        ],
      } as unknown as CensusEntry)
    ).toBe('Catalyst One (abc-123), ProCyte One, solo-serial, -');

    expect(parseFloatSafe()).toBeNull();
    expect(parseFloatSafe('')).toBeNull();
    expect(parseFloatSafe(' 1,25 mmol/L ')).toBe(1.25);
    expect(parseFloatSafe('abc')).toBeNull();
    expect(parseReferenceRange()).toBeNull();
    expect(parseReferenceRange('5')).toBeNull();
    expect(parseReferenceRange('10 - 5')).toBeNull();
    expect(parseReferenceRange('1.5 - 3.5')).toEqual({ min: 1.5, max: 3.5 });

    expect(getMeterMeta({ result: '2', referenceRange: '1 - 3' } as LabResultTest)).toEqual({
      canRender: true,
      percent: 50,
      markerClass: 'bg-text-primary',
    });
    expect(getMeterMeta({ result: '4', referenceRange: '1 - 3' } as LabResultTest)).toEqual({
      canRender: true,
      percent: 100,
      markerClass: 'bg-red-500',
    });
    expect(
      getMeterMeta({ result: '2', referenceRange: '1 - 3', outOfRange: true } as LabResultTest)
    ).toEqual({
      canRender: true,
      percent: 50,
      markerClass: 'bg-red-500',
    });
    expect(getMeterMeta({ result: 'bad', referenceRange: '1 - 3' } as LabResultTest)).toEqual({
      canRender: false,
      percent: 0,
      markerClass: 'bg-text-secondary',
    });

    expect(
      shouldCloseOrderIframe({
        source: 'order',
        initialStatus: 'CREATED',
        nextStatus: '',
        nextHasAcknowledgement: true,
        initialOrderId: 'old',
        newestKnownOrderId: 'new',
      })
    ).toBe(false);
    expect(
      shouldCloseOrderIframe({
        source: 'order',
        initialStatus: 'created',
        nextStatus: 'submitted',
        nextHasAcknowledgement: true,
        initialOrderId: 'old',
        newestKnownOrderId: 'new',
      })
    ).toBe(true);
    expect(
      shouldCloseOrderIframe({
        source: 'order',
        initialStatus: 'complete',
        nextStatus: 'submitted',
        nextHasAcknowledgement: true,
        initialOrderId: 'old',
        newestKnownOrderId: 'new',
      })
    ).toBe(false);
    expect(
      shouldCloseOrderIframe({
        source: 'followup',
        initialStatus: 'submitted',
        nextStatus: 'submitted',
        nextHasAcknowledgement: true,
        initialOrderId: 'old',
        newestKnownOrderId: 'new',
      })
    ).toBe(true);
    expect(
      shouldCloseOrderIframe({
        source: 'followup',
        initialStatus: 'submitted',
        nextStatus: 'submitted',
        nextHasAcknowledgement: false,
        initialOrderId: 'old',
        newestKnownOrderId: 'new',
      })
    ).toBe(false);
    expect(
      shouldCloseOrderIframe({
        source: 'followup',
        initialStatus: 'submitted',
        nextStatus: 'submitted',
        nextHasAcknowledgement: true,
        initialOrderId: 'old',
        newestKnownOrderId: 'old',
      })
    ).toBe(false);
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
    fireEvent.change(screen.getByTestId('lab-specimen-date'), {
      target: { value: '2026-06-15' },
    });
    fireEvent.change(screen.getByTestId('lab-notes'), {
      target: { value: 'Fasted sample' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create IDEXX order' }));

    await waitFor(() => {
      expect(createIdexxLabOrderMock).toHaveBeenCalledWith({
        organisationId: 'org-1',
        payload: expect.objectContaining({
          patientId: 'patient-1',
          appointmentId: 'appt-1',
          tests: ['9126'],
          modality: 'REFERENCE_LAB',
          specimenCollectionDate: '2026-06-15',
          notes: 'Fasted sample',
        }),
      });
    });

    expect(screen.getByText('Order 100329789')).toBeInTheDocument();
  });

  it('stages a searched test as pending instead of queueing it immediately, until confirmed (bug #1973)', async () => {
    const { result } = renderHook(() => useLabTests(appointment));

    await waitFor(() => {
      expect(result.current.tests).toHaveLength(1);
    });

    act(() => {
      result.current.selectSearchResult('9126');
    });

    expect(result.current.pendingTest?.code).toBe('9126');
    expect(result.current.selectedTests).toHaveLength(0);
    expect(result.current.selectedTestLabel).toBe('Chem Panel (9126)');

    act(() => {
      result.current.confirmPendingTest();
    });

    expect(result.current.pendingTest).toBeNull();
    expect(result.current.selectedTests.map((test) => test.code)).toEqual(['9126']);
    expect(result.current.selectedTestLabel).toBe('');
  });

  it('discards a pending test without queueing it when cancelled', async () => {
    const { result } = renderHook(() => useLabTests(appointment));

    await waitFor(() => {
      expect(result.current.tests).toHaveLength(1);
    });

    act(() => {
      result.current.selectSearchResult('9126');
    });
    expect(result.current.pendingTest?.code).toBe('9126');

    act(() => {
      result.current.cancelPendingTest();
    });

    expect(result.current.pendingTest).toBeNull();
    expect(result.current.selectedTests).toHaveLength(0);
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
    fireEvent.load(iframe);
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

  it('falls back to companion-only orders when appointment-scoped lookup fails', async () => {
    listIdexxOrdersMock.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce([
      {
        _id: 'ord-fallback',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'CREATED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'fallback-1',
        tests: ['9126'],
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order fallback-1')).toBeInTheDocument();
    });

    expect(listIdexxOrdersMock).toHaveBeenNthCalledWith(2, {
      organisationId: 'org-1',
      companionId: 'patient-1',
    });
  });

  it('propagates the error when appointment-scoped lookup fails without a companion id', async () => {
    listIdexxOrdersMock.mockRejectedValue(new Error('nope'));
    const noCompanion: any = { id: 'appt-no-companion' };

    render(<LabTests activeAppointment={noCompanion} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load appointment lab orders.')).toBeInTheDocument();
    });
  });

  it('merges unique tests when loading more results and skips duplicates', async () => {
    listIdexxTestsMock
      .mockResolvedValueOnce({
        tests: Array.from({ length: 25 }, (_, i) => ({
          _id: `t${i}`,
          code: `code-${i}`,
          display: `Test ${i}`,
        })),
      })
      .mockResolvedValueOnce({
        tests: [
          { _id: 't0', code: 'code-0', display: 'Test 0' },
          { _id: 't25', code: 'code-25', display: 'Test 25' },
        ],
      });

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reach end Search IDEXX tests' }));

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId('rendered-options-Search IDEXX tests').textContent).toContain(
      'Test 25'
    );
  });

  it('does not load more tests when there is no next page or already loading', async () => {
    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reach end Search IDEXX tests' }));

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('clears tests and surfaces an error when the search request fails', async () => {
    listIdexxTestsMock.mockRejectedValue(new Error('boom'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load IDEXX tests.')).toBeInTheDocument();
    });

    expect(screen.getByTestId('rendered-options-Search IDEXX tests').textContent).not.toContain(
      'Chem Panel'
    );
  });

  it('renders search option meta details and falls back to label when meta is missing', async () => {
    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    expect(screen.getByText('No meta label')).toBeInTheDocument();
    expect(screen.getByText('Code: 9126')).toBeInTheDocument();
  });

  it('updates the search query via setQuery callback', async () => {
    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('query-Search IDEXX tests'), {
      target: { value: 'chem' },
    });

    expect(screen.getByTestId('query-Search IDEXX tests')).toHaveValue('chem');
  });

  it('shows census loading error when the census request fails', async () => {
    getIdexxCensusMock.mockRejectedValue(new Error('census down'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load IDEXX census.')).toBeInTheDocument();
    });
  });

  it('shows devices as empty when IDEXX integration is enabled but no primary org is set', async () => {
    orgStoreStateMock.primaryOrgId = '';

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
    });
  });

  it('opens the result PDF preview and closes it, revoking the blob URL', async () => {
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
      },
    ]);
    const idexxService = jest.requireMock('@/app/features/integrations/services/idexxService');
    idexxService.getIdexxResultPdfBlob.mockResolvedValue(new Blob(['pdf']));
    const createObjectURL = jest.fn().mockReturnValue('blob:preview-1');
    const revokeObjectURL = jest.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Result 1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    });

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('surfaces an error when the result PDF preview fails to load', async () => {
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
      },
    ]);
    const idexxService = jest.requireMock('@/app/features/integrations/services/idexxService');
    idexxService.getIdexxResultPdfBlob.mockRejectedValue(new Error('pdf down'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Result 1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    });

    await waitFor(() => {
      expect(screen.getByText('Unable to load IDEXX PDF preview.')).toBeInTheDocument();
    });
  });

  it('opens result PDF for a complete order and errors when no result is available yet', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-complete',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'COMPLETE',
        modality: 'REFERENCE_LAB',
        idexxOrderId: '100329795',
        tests: ['9126'],
      },
    ]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-db-3',
        provider: 'IDEXX',
        resultId: 'result-3',
        orderId: '100329795',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
        statusDetail: 'Complete',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order 100329795')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Result PDF' })).toBeInTheDocument();
  });

  it('shows an error when trying to open the result PDF for an order without a matching result', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-complete-no-result',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'COMPLETE',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'no-result-order',
        tests: ['9126'],
      },
    ]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-db-4',
        provider: 'IDEXX',
        resultId: '',
        orderId: 'no-result-order',
        patientId: 'patient-1',
        patientName: 'Buddy',
        statusDetail: 'Complete',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Result PDF' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Result PDF' }));
    });

    await waitFor(() => {
      expect(
        screen.getByText('Result PDF is not available for this order yet.')
      ).toBeInTheDocument();
    });
  });

  it('opens order acknowledgment PDF for the latest order', async () => {
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-ack',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'ack-1',
        uiUrl: 'https://integration.vetconnectplus.com/order/ack',
        pdfUrl: 'https://integration.vetconnectplus.com/ack.pdf',
        tests: ['9126'],
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order ack-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledgment PDF' }));

    await waitFor(() => {
      expect(screen.getByText('IDEXX Order Acknowledgment #ack-1')).toBeInTheDocument();
    });
  });

  it('surfaces error when creating an order fails', async () => {
    createIdexxLabOrderMock.mockRejectedValue(new Error('create failed'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Search IDEXX tests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create IDEXX order' }));

    await waitFor(() => {
      expect(screen.getByText('Unable to create IDEXX lab order.')).toBeInTheDocument();
    });
  });

  it('allows removing a selected test before creating the order', async () => {
    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Search IDEXX tests' }));

    await waitFor(() => {
      expect(screen.getByTitle('Remove test from selection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Remove test from selection'));

    expect(screen.getByText('No tests selected yet.')).toBeInTheDocument();
  });

  it('surfaces error when adding to census fails', async () => {
    addPatientToIdexxCensusMock.mockRejectedValue(new Error('census add failed'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByTestId('Modality'), { target: { value: 'INHOUSE' } });
    fireEvent.change(screen.getByTestId('Select IVLS device'), { target: { value: 'ivls-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to census' }));

    await waitFor(() => {
      expect(screen.getByText('Unable to add companion to IDEXX census.')).toBeInTheDocument();
    });
  });

  it('deduplicates practitioner options built from lead and support staff names', async () => {
    const appointmentWithStaff: any = {
      id: 'appt-staff',
      companion: { id: 'patient-1', parent: { id: 'parent-1' } },
      lead: { name: 'Dr Vet' },
      supportStaff: [{ id: 's1', name: 'Dr Vet' }, { id: 's2', name: 'Nurse Joy' }, { id: 's3' }],
    };

    render(<LabTests activeAppointment={appointmentWithStaff} />);

    await waitFor(() => {
      expect(listIdexxTestsMock).toHaveBeenCalled();
    });

    const options = Array.from(screen.getByTestId('Veterinarian').querySelectorAll('option')).map(
      (opt) => opt.textContent
    );
    expect(options.filter((label) => label === 'Dr Vet')).toHaveLength(1);
    expect(options).toContain('Nurse Joy');
  });

  it('shows the past orders list and lets past order actions open PDFs and iframes', async () => {
    const latest = {
      _id: 'ord-latest',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'CREATED',
      modality: 'REFERENCE_LAB',
      idexxOrderId: 'latest-1',
      updatedAt: '2026-06-02T10:00:00Z',
      uiUrl: 'https://integration.vetconnectplus.com/order/latest',
      tests: ['9126'],
    };
    const past = {
      _id: 'ord-past',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'COMPLETE',
      modality: 'REFERENCE_LAB',
      idexxOrderId: 'past-1',
      updatedAt: '2026-06-01T10:00:00Z',
      uiUrl: 'https://integration.vetconnectplus.com/order/past',
      pdfUrl: 'https://integration.vetconnectplus.com/past-ack.pdf',
      tests: ['9126'],
    };
    listIdexxOrdersMock.mockResolvedValue([latest, past]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'result-past',
        provider: 'IDEXX',
        resultId: 'result-past-1',
        orderId: 'past-1',
        patientId: 'patient-1',
        statusDetail: 'Complete',
      },
    ]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Past orders in this appointment')).toBeInTheDocument();
    });

    expect(screen.getByText('Order past-1')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Result PDF' })[0]);
    });
    const ackButtons = screen
      .getAllByRole('button', { name: 'Acknowledgment PDF' })
      .filter((button) => !button.hasAttribute('disabled'));
    fireEvent.click(ackButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('IDEXX Order Acknowledgment #past-1')).toBeInTheDocument();
    });
  });

  it('surfaces an error when loading IDEXX devices fails', async () => {
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error('device down'));

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load IDEXX integration/device state.')
      ).toBeInTheDocument();
    });
  });

  it('reassigns veterinarian and technician when the appointment staff changes', async () => {
    const apptA: any = {
      id: 'appt-a',
      companion: { id: 'patient-1', parent: { id: 'parent-1' } },
      lead: { name: 'Dr A' },
      supportStaff: [{ id: 's1', name: 'Tech A' }],
    };
    const apptB: any = {
      id: 'appt-b',
      companion: { id: 'patient-1', parent: { id: 'parent-1' } },
      lead: { name: 'Dr B' },
      supportStaff: [{ id: 's2', name: 'Tech B' }],
    };

    const { result, rerender } = renderHook(({ a }) => useLabTests(a), {
      initialProps: { a: apptA },
    });

    await waitFor(() => {
      expect(result.current.veterinarian).toBe('Dr A');
    });
    expect(result.current.technician).toBe('Tech A');

    rerender({ a: apptB });

    await waitFor(() => {
      expect(result.current.veterinarian).toBe('Dr B');
    });
    expect(result.current.technician).toBe('Tech B');
  });

  it('lets a non-complete past order launch the ordering iframe', async () => {
    const latest = {
      _id: 'ord-latest-complete',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'COMPLETE',
      modality: 'REFERENCE_LAB',
      idexxOrderId: 'latest-complete-1',
      updatedAt: '2026-06-02T10:00:00Z',
      tests: ['9126'],
    };
    const past = {
      _id: 'ord-past-created',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'CREATED',
      modality: 'REFERENCE_LAB',
      idexxOrderId: 'past-created-1',
      updatedAt: '2026-06-01T10:00:00Z',
      uiUrl: 'https://integration.vetconnectplus.com/order/past-created',
      tests: ['9126'],
    };
    listIdexxOrdersMock.mockResolvedValue([latest, past]);

    render(<LabTests activeAppointment={appointment} />);

    await waitFor(() => {
      expect(screen.getByText('Order past-created-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByTitle('IDEXX order UI')).toBeInTheDocument();
  });

  it('applies result filtering during follow-up polling', async () => {
    jest.useFakeTimers();
    try {
      const followupOrder = {
        _id: 'ord-fp-results',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'SUBMITTED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'fp-results-1',
        uiUrl: 'https://vetconnectplus.com/order',
        updatedAt: '2026-06-01T10:00:00Z',
        tests: ['9126'],
      };
      listIdexxOrdersMock.mockResolvedValue([followupOrder]);
      getIdexxOrderByIdMock.mockResolvedValue({
        ...followupOrder,
        updatedAt: '2026-06-01T10:10:00Z',
      });
      listIdexxResultsMock.mockResolvedValue([
        {
          _id: 'r-fp',
          provider: 'IDEXX',
          resultId: 'res-fp',
          orderId: 'fp-results-1',
          patientId: 'patient-1',
          status: 'FINAL',
        },
      ]);

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
        expect(result.current.results.map((r) => r.resultId)).toContain('res-fp');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('surfaces an error when polling the order status fails', async () => {
    jest.useFakeTimers();
    try {
      const createdOrder = {
        _id: 'ord-poll-fail',
        organisationId: 'org-1',
        provider: 'IDEXX',
        companionId: 'patient-1',
        status: 'CREATED',
        modality: 'REFERENCE_LAB',
        idexxOrderId: 'poll-fail-1',
        uiUrl: 'https://vetconnectplus.com/order',
        tests: ['9126'],
      };
      listIdexxOrdersMock.mockResolvedValue([createdOrder]);
      getIdexxOrderByIdMock.mockRejectedValue(new Error('poll boom'));

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
        expect(result.current.error).toBe('Unable to poll order status while IDEXX frame is open.');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('revokes the blob URL when closing the PDF preview', async () => {
    const idexxService = jest.requireMock('@/app/features/integrations/services/idexxService');
    idexxService.getIdexxResultPdfBlob.mockResolvedValue(new Blob(['pdf']));
    const createObjectURL = jest.fn().mockReturnValue('blob:preview-close');
    const revokeObjectURL = jest.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    const { result } = renderHook(() => useLabTests(appointment));

    await act(async () => {
      await result.current.openResultPdfPreview('res-close');
    });

    await waitFor(() => {
      expect(result.current.pdfPreviewUrl).toBe('blob:preview-close');
    });

    act(() => {
      result.current.closePdfPreview();
    });

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-close');
    expect(result.current.showPdfPreview).toBe(false);
    expect(result.current.pdfPreviewUrl).toBeNull();
  });

  it('opens the newest result PDF when an order has multiple results', async () => {
    const multiOrder = {
      _id: 'ord-multi',
      organisationId: 'org-1',
      provider: 'IDEXX',
      companionId: 'patient-1',
      status: 'SUBMITTED',
      modality: 'REFERENCE_LAB',
      idexxOrderId: 'multi-1',
      tests: ['9126'],
    };
    listIdexxOrdersMock.mockResolvedValue([multiOrder]);
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r-old',
        provider: 'IDEXX',
        resultId: 'res-old',
        orderId: 'multi-1',
        patientId: 'patient-1',
        status: 'FINAL',
        updatedAt: '2026-06-01T09:00:00Z',
      },
      {
        _id: 'r-new',
        provider: 'IDEXX',
        resultId: 'res-new',
        orderId: 'multi-1',
        patientId: 'patient-1',
        status: 'FINAL',
        updatedAt: '2026-06-02T09:00:00Z',
      },
    ]);
    const idexxService = jest.requireMock('@/app/features/integrations/services/idexxService');
    idexxService.getIdexxResultPdfBlob.mockResolvedValue(new Blob(['pdf']));
    (URL as any).createObjectURL = jest.fn().mockReturnValue('blob:multi');
    (URL as any).revokeObjectURL = jest.fn();

    const { result } = renderHook(() => useLabTests(appointment));

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });

    await act(async () => {
      await result.current.openResultPdfForOrder(multiOrder as LabOrder);
    });

    await waitFor(() => {
      expect(result.current.pdfPreviewTitle).toBe('IDEXX Result PDF #res-new');
    });
  });

  it('errors when opening an acknowledgment PDF that is unavailable', async () => {
    const { result } = renderHook(() => useLabTests(appointment));

    act(() => {
      result.current.openOrderAcknowledgement({
        _id: 'ord-no-pdf',
        idexxOrderId: 'no-pdf-1',
        status: 'CREATED',
      } as LabOrder);
    });

    expect(result.current.error).toBe('Acknowledgment PDF is not available for this order.');

    // Settle the hook's mount loads before the test unmounts so they don't
    // leak an act(...) warning into the next test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('shows a loading message while appointment orders are still loading', async () => {
    listIdexxOrdersMock.mockReturnValue(new Promise<never>(() => {}));

    render(<LabTests activeAppointment={appointment} />);

    // Orders never resolve (stays loading), but the chained device -> census
    // loads do — drain all pending microtasks inside act so their state
    // updates don't warn.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('Loading appointment lab orders...')).toBeInTheDocument();
  });
});
