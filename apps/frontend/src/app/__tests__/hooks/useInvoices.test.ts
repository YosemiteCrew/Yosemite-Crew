import { renderHook, waitFor } from '@testing-library/react';
import {
  useLoadInvoicesForPrimaryOrg,
  useInvoicesForPrimaryOrg,
  useInvoicesForPrimaryOrgAppointment,
  usePaidInvoiceForPrimaryOrgAppointment,
} from '@/app/hooks/useInvoices';
import { useOrgStore } from '@/app/stores/orgStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import {
  loadInvoicesForAppointment,
  loadInvoicesForOrgPrimaryOrg,
} from '@/app/features/billing/services/invoiceService';

// --- Mocks ---

jest.mock('@/app/stores/orgStore');
jest.mock('@/app/stores/invoiceStore');
jest.mock('@/app/features/billing/services/invoiceService');

const mockInvoiceGetState = jest.fn();

describe('useInvoices Hooks', () => {
  let mockOrgState: any;
  let mockInvoiceState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = { primaryOrgId: null };
    mockInvoiceState = {
      invoicesById: {},
      invoiceIdsByOrgId: {},
    };

    // Setup Store Mocks to behave like Zustand selectors
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => selector(mockOrgState));
    (useInvoiceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockInvoiceState)
    );
    mockInvoiceGetState.mockReturnValue(mockInvoiceState);
    (useInvoiceStore as unknown as jest.Mock & { getState: jest.Mock }).getState =
      mockInvoiceGetState;
  });

  describe('useLoadInvoicesForPrimaryOrg', () => {
    it('should call load service when primaryOrgId is present', () => {
      mockOrgState.primaryOrgId = 'org-1';

      renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledTimes(1);
    });

    it('should NOT call load service when primaryOrgId is missing', () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).not.toHaveBeenCalled();
    });

    it('should re-call service when primaryOrgId changes', async () => {
      mockOrgState.primaryOrgId = 'org-1';
      const { rerender } = renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = 'org-2';
      rerender();

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  describe('useInvoicesForPrimaryOrg', () => {
    const mockInvoices = {
      'inv-1': { id: 'inv-1', amount: 100 },
      'inv-2': { id: 'inv-2', amount: 200 },
    };

    it('should return an empty array if primaryOrgId is missing', () => {
      mockOrgState.primaryOrgId = null;
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1'] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it('should return an empty array if no invoices exist for the organization', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = {}; // No entry for org-1

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it('should return mapped invoice objects for the organization', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1', 'inv-2'] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { id: 'inv-1', amount: 100 },
        { id: 'inv-2', amount: 200 },
      ]);
    });

    it('should filter out undefined invoices (broken IDs)', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = mockInvoices;
      // 'inv-99' exists in the list but not in invoicesById
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1', 'inv-99'] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      // Should return only inv-1, filtering out the broken link
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ id: 'inv-1', amount: 100 });
    });
  });

  describe('useInvoicesForPrimaryOrgAppointment', () => {
    it('loads appointment invoices when org cache has no matching invoice', async () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {};
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': [] };

      renderHook(() => useInvoicesForPrimaryOrgAppointment('apt-1'));

      await waitFor(() => {
        expect(loadInvoicesForAppointment).toHaveBeenCalledWith('apt-1');
      });
    });

    it('does not load appointment invoices when matching invoice already exists', async () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {
        'inv-1': { id: 'inv-1', appointmentId: 'apt-1', amount: 100 },
      };
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1'] };

      renderHook(() => useInvoicesForPrimaryOrgAppointment('apt-1'));

      await waitFor(() => {
        expect(loadInvoicesForAppointment).not.toHaveBeenCalled();
      });
    });

    it('returns empty array when appointmentId is undefined', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {};
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': [] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrgAppointment(undefined));
      expect(result.current).toEqual([]);
    });
  });

  describe('usePaidInvoiceForPrimaryOrgAppointment', () => {
    it('returns undefined when no primaryOrgId', () => {
      mockOrgState.primaryOrgId = null;
      mockInvoiceState.invoicesById = {};
      mockInvoiceState.invoiceIdsByOrgId = {};

      const { result } = renderHook(() => usePaidInvoiceForPrimaryOrgAppointment('apt-1'));
      expect(result.current).toBeUndefined();
    });

    it('returns undefined when appointmentId is undefined', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {};
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': [] };

      const { result } = renderHook(() => usePaidInvoiceForPrimaryOrgAppointment(undefined));
      expect(result.current).toBeUndefined();
    });

    it('returns undefined when no PAID invoice found for appointment', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {
        'inv-1': { id: 'inv-1', appointmentId: 'apt-1', status: 'PENDING' },
      };
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1'] };

      const { result } = renderHook(() => usePaidInvoiceForPrimaryOrgAppointment('apt-1'));
      expect(result.current).toBeUndefined();
    });

    it('returns the PAID invoice for the matching appointment', () => {
      const paidInvoice = { id: 'inv-2', appointmentId: 'apt-2', status: 'PAID' };
      mockOrgState.primaryOrgId = 'org-1';
      mockInvoiceState.invoicesById = {
        'inv-1': { id: 'inv-1', appointmentId: 'apt-2', status: 'PENDING' },
        'inv-2': paidInvoice,
      };
      mockInvoiceState.invoiceIdsByOrgId = { 'org-1': ['inv-1', 'inv-2'] };

      const { result } = renderHook(() => usePaidInvoiceForPrimaryOrgAppointment('apt-2'));
      expect(result.current).toEqual(paidInvoice);
    });
  });
});
