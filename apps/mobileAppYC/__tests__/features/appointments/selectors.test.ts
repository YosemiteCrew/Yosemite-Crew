import {
  createSelectAppointmentsByCompanion,
  createSelectUpcomingAppointments,
  createSelectPastAppointments,
  createSelectBusinessesByCategory,
  selectEmployeesForBusiness,
  createSelectEmployeesForBusiness,
  createSelectServicesForBusiness,
  selectServiceById,
  selectAvailabilityFor,
  selectInvoiceForAppointment,
} from '../../../src/features/appointments/selectors';
import type { RootState } from '../../../src/app/store';

describe('Appointment Selectors', () => {
  // --- Mock Data ---
  const mockAppointments = [
    { id: '1', companionId: 'c1', status: 'PENDING', date: '2025-01-01' },
    { id: '2', companionId: 'c1', status: 'COMPLETED', date: '2024-01-01' },
    { id: '3', companionId: 'c2', status: 'CANCELLED', date: '2024-01-01' },
    { id: '4', companionId: 'c1', status: 'CONFIRMED', date: '2025-02-01' },
  ];

  const mockBusinesses = [
    { id: 'b1', name: 'Vet A', category: 'veterinarian' },
    { id: 'b2', name: 'Groomer B', category: 'groomer' },
    { id: 'b3', name: 'Vet C', category: 'veterinarian' },
  ];

  const mockServices = [
    { id: 's1', businessId: 'b1', name: 'Checkup' },
    { id: 's2', businessId: 'b1', name: 'Surgery' },
    { id: 's3', businessId: 'b2', name: 'Wash' },
  ];

  const mockEmployees = [
    { id: 'e1', businessId: 'b1', name: 'Doc A' },
    { id: 'e2', businessId: 'b1', name: 'Nurse B' },
    { id: 'e3', businessId: 'b2', name: 'Groomer C' },
  ];

  const mockAvailability = [
    { businessId: 'b1', serviceId: 's1', slots: ['10:00'] },
    { businessId: 'b1', employeeId: 'e1', slots: ['11:00'] },
    { businessId: 'b1', slots: ['09:00'] }, // General business availability
  ];

  const mockInvoices = [
    { id: 'inv1', appointmentId: '1', amount: 100 },
  ];

  const mockState: RootState = {
    appointments: {
      items: mockAppointments,
      invoices: mockInvoices,
      loading: false,
      error: null,
      filters: {},
    },
    businesses: {
      businesses: mockBusinesses,
      services: mockServices,
      employees: mockEmployees,
      availability: mockAvailability,
      loading: false,
      error: null,
    },
  } as unknown as RootState;

  // State with undefined slices to test optional chaining logic (?? [])
  const emptyState: RootState = {
    appointments: undefined,
    businesses: undefined,
  } as unknown as RootState;

  // =========================================================================
  // 1. Appointment Filtering Selectors
  // =========================================================================
  describe('Appointment Filters', () => {
    describe('createSelectAppointmentsByCompanion', () => {
      const selectByCompanion = createSelectAppointmentsByCompanion();

      it('filters appointments by companionId', () => {
        const result = selectByCompanion(mockState, 'c1');
        expect(result).toHaveLength(3); // id: 1, 2, 4
        expect(result.map((a: any) => a.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
      });

      it('returns all appointments if companionId is null', () => {
        const result = selectByCompanion(mockState, null);
        expect(result).toHaveLength(4);
      });

      it('returns empty array if state.appointments is undefined', () => {
        const result = selectByCompanion(emptyState, 'c1');
        expect(result).toEqual([]);
      });
    });

    describe('createSelectUpcomingAppointments', () => {
      const selectUpcoming = createSelectUpcomingAppointments();

      it('returns only non-completed/non-cancelled appointments for a companion', () => {
        // c1 has: 1(PENDING), 2(COMPLETED), 4(CONFIRMED) -> Expect 1, 4
        const result = selectUpcoming(mockState, 'c1');
        expect(result).toHaveLength(2);
        expect(result.map((a: any) => a.id)).toEqual(expect.arrayContaining(['1', '4']));
      });

      it('filters out COMPLETED and CANCELLED statuses', () => {
        // c2 has: 3(CANCELLED) -> Expect empty
        const result = selectUpcoming(mockState, 'c2');
        expect(result).toHaveLength(0);
      });
    });

    describe('createSelectPastAppointments', () => {
      const selectPast = createSelectPastAppointments();

      it('returns only COMPLETED or CANCELLED appointments for a companion', () => {
        // c1 has: 2(COMPLETED) -> Expect 2
        const result = selectPast(mockState, 'c1');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('2');
      });

      it('includes CANCELLED status', () => {
        // c2 has: 3(CANCELLED) -> Expect 3
        const result = selectPast(mockState, 'c2');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('3');
      });
    });
  });

  // =========================================================================
  // 2. Business & Service Selectors
  // =========================================================================
  describe('Business & Service Selectors', () => {
    describe('createSelectBusinessesByCategory', () => {
      const selectByCategory = createSelectBusinessesByCategory();

      it('filters businesses by category', () => {
        const result = selectByCategory(mockState, 'veterinarian' as any);
        expect(result).toHaveLength(2); // b1, b3
        expect(result.map((b: any) => b.id)).toEqual(expect.arrayContaining(['b1', 'b3']));
      });

      it('returns all businesses if category is undefined', () => {
        const result = selectByCategory(mockState, undefined);
        expect(result).toHaveLength(3);
      });

      it('returns empty array if businesses slice is missing', () => {
        const result = selectByCategory(emptyState, 'veterinarian' as any);
        expect(result).toEqual([]);
      });
    });

    describe('selectEmployeesForBusiness (Curried)', () => {
      it('filters employees by businessId', () => {
        const selector = selectEmployeesForBusiness('b1');
        const result = selector(mockState);
        expect(result).toHaveLength(2); // e1, e2
        expect(result[0].name).toBe('Doc A');
      });

      it('returns empty array if no match', () => {
        const selector = selectEmployeesForBusiness('b99');
        const result = selector(mockState);
        expect(result).toEqual([]);
      });
    });

    describe('createSelectEmployeesForBusiness (Memoized)', () => {
      const selectEmployees = createSelectEmployeesForBusiness();

      it('filters employees by businessId param', () => {
        const result = selectEmployees(mockState, 'b2');
        expect(result).toHaveLength(1); // e3
        expect(result[0].name).toBe('Groomer C');
      });
    });

    describe('createSelectServicesForBusiness', () => {
      const selectServices = createSelectServicesForBusiness();

      it('filters services by businessId', () => {
        const result = selectServices(mockState, 'b1');
        expect(result).toHaveLength(2); // s1, s2
      });

      it('returns empty array if state services undefined', () => {
        const result = selectServices(emptyState, 'b1');
        expect(result).toEqual([]);
      });
    });

    describe('selectServiceById', () => {
      it('finds service by id', () => {
        const selector = selectServiceById('s1');
        const result = selector(mockState);
        expect(result).toEqual(mockServices[0]);
      });

      it('returns null if serviceId is null/undefined', () => {
        const selector = selectServiceById(null);
        expect(selector(mockState)).toBeNull();
      });

      it('returns null if service not found', () => {
        const selector = selectServiceById('s99');
        expect(selector(mockState)).toBeNull();
      });
    });
  });

  // =========================================================================
  // 3. Availability Selectors (Branch Priority Logic)
  // =========================================================================
  describe('selectAvailabilityFor', () => {
    // 1. Service ID Priority
    it('returns service-specific availability if serviceId provided and found', () => {
      // opts: { serviceId: 's1' } matches first mock entry
      const selector = selectAvailabilityFor('b1', { serviceId: 's1' });
      const result = selector(mockState);
      expect(result).toEqual(mockAvailability[0]);
    });

    // 2. Employee ID Priority
    it('returns employee-specific availability if employeeId provided and found', () => {
      // opts: { employeeId: 'e1' } matches second mock entry
      const selector = selectAvailabilityFor('b1', { employeeId: 'e1' });
      const result = selector(mockState);
      expect(result).toEqual(mockAvailability[1]);
    });

    // 6. No availability found at all
    it('returns null if no availability found for business', () => {
      const selector = selectAvailabilityFor('b99');
      const result = selector(mockState);
      expect(result).toBeNull();
    });

    // 7. Prioritization check: Service > Employee
    it('prioritizes service over employee if both provided', () => {
      // s1 matches, e1 also matches a different entry. Should return s1 entry.
      const selector = selectAvailabilityFor('b1', { serviceId: 's1', employeeId: 'e1' });
      const result = selector(mockState);
      expect(result).toEqual(mockAvailability[0]); // s1 entry
    });
  });

  // =========================================================================
  // 4. Invoice Selectors
  // =========================================================================
  describe('selectInvoiceForAppointment', () => {
    it('finds invoice by appointmentId', () => {
      const selector = selectInvoiceForAppointment('1');
      const result = selector(mockState);
      expect(result).toEqual(mockInvoices[0]);
    });

    it('returns null if invoice not found', () => {
      const selector = selectInvoiceForAppointment('99');
      const result = selector(mockState);
      expect(result).toBeNull();
    });
  });
});