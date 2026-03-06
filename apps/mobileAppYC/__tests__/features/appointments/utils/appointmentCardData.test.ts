import {transformAppointmentCardData} from '@/features/appointments/utils/appointmentCardData';

// Mock currency utility
jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: jest.fn((currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
    };
    return symbols[currency] || '$';
  }),
}));

describe('appointmentCardData', () => {
  describe('transformAppointmentCardData', () => {
    const mockImages = {
      cat: {uri: 'cat-placeholder'},
    };

    const createMockAppointment = (overrides = {}) => ({
      id: 'apt-1',
      businessId: 'biz-1',
      companionId: 'comp-1',
      serviceId: 'svc-1',
      employeeId: 'emp-1',
      status: 'UPCOMING',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T11:00:00Z',
      ...overrides,
    });

    const createBusinessMap = (businesses: any[] = []) => {
      const map = new Map();
      businesses.forEach(biz => map.set(biz.id, biz));
      return map;
    };

    const createEmployeeMap = (employees: any[] = []) => {
      const map = new Map();
      employees.forEach(emp => map.set(emp.id, emp));
      return map;
    };

    const createServiceMap = (services: any[] = []) => {
      const map = new Map();
      services.forEach(svc => map.set(svc.id, svc));
      return map;
    };

    describe('avatar source priority', () => {
      it('should use employee avatar when available', () => {
        const appointment = createMockAppointment({
          employeeId: 'emp-1',
          employeeName: 'Dr. Smith',
          employeeAvatar: 'https://example.com/avatar.jpg',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.avatarSource).toEqual({uri: 'https://example.com/avatar.jpg'});
      });

      it('should use business photo when no employee avatar', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          businessId: 'biz-1',
        });
        const bizMap = createBusinessMap([{id: 'biz-1', photo: 'https://example.com/business.jpg'}]);

        const result = transformAppointmentCardData(
          appointment,
          bizMap,
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.avatarSource).toBe('https://example.com/business.jpg');
      });

      it('should use fallback photo when no business photo', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          businessId: 'biz-1',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap([{id: 'biz-1'}]),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {'biz-1': {photo: 'https://example.com/fallback.jpg'}},
          mockImages,
        );

        expect(result.avatarSource).toBe('https://example.com/fallback.jpg');
      });

      it('should use companion avatar when no business photos', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          companionId: 'comp-1',
        });
        const companions = [{id: 'comp-1', profileImage: 'https://example.com/pet.jpg', name: 'Fluffy'}];

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          companions,
          {},
          mockImages,
        );

        expect(result.avatarSource).toEqual({uri: 'https://example.com/pet.jpg'});
      });

      it('should use cat placeholder when no other images', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          companionId: 'comp-1',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.avatarSource).toEqual({uri: 'cat-placeholder'});
      });
    });

    describe('card title and subtitle', () => {
      it('should show assigned vet name as title when employee exists', () => {
        const appointment = createMockAppointment({
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith', specialization: 'Surgery'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.cardTitle).toBe('Dr. Smith');
        expect(result.cardSubtitle).toBe('Surgery');
        expect(result.hasAssignedVet).toBe(true);
      });

      it('should show employeeName when employee not in map', () => {
        const appointment = createMockAppointment({
          employeeId: 'emp-1',
          employeeName: 'Dr. Johnson',
          employeeTitle: 'Veterinarian',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.cardTitle).toBe('Dr. Johnson');
        expect(result.cardSubtitle).toBe('Veterinarian');
        expect(result.hasAssignedVet).toBe(true);
      });

      it('should show service name as title when no employee', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
        });
        const svcMap = createServiceMap([{id: 'svc-1', name: 'Checkup', specialty: 'General'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          svcMap,
          [],
          {},
          mockImages,
        );

        expect(result.cardTitle).toBe('Checkup');
        expect(result.hasAssignedVet).toBe(false);
      });

      it('should show serviceName from appointment when service not in map', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
          serviceName: 'Vaccination',
          type: 'Preventive',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.cardTitle).toBe('Vaccination');
      });

      it('should show "Service request" as fallback title', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: null,
          serviceName: null,
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.cardTitle).toBe('Service request');
      });

      it('should include price in subtitle when service has basePrice', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
        });
        const svcMap = createServiceMap([
          {id: 'svc-1', name: 'Checkup', specialty: 'General', basePrice: 50, currency: 'USD'},
        ]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          svcMap,
          [],
          {},
          mockImages,
        );

        expect(result.cardSubtitle).toBe('General • $50');
        expect(result.servicePriceText).toBe('$50');
      });

      it('should handle EUR currency symbol', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
        });
        const svcMap = createServiceMap([
          {id: 'svc-1', name: 'Checkup', basePrice: 50, currency: 'EUR'},
        ]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          svcMap,
          [],
          {},
          mockImages,
        );

        expect(result.servicePriceText).toBe('€50');
      });

      it('should not include price when service has no basePrice', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
        });
        const svcMap = createServiceMap([{id: 'svc-1', name: 'Checkup', specialty: 'General'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          svcMap,
          [],
          {},
          mockImages,
        );

        expect(result.cardSubtitle).toBe('General');
        expect(result.servicePriceText).toBeNull();
      });
    });

    describe('business and location data', () => {
      it('should extract business name and address from business map', () => {
        const appointment = createMockAppointment();
        const bizMap = createBusinessMap([
          {
            id: 'biz-1',
            name: 'Pet Clinic',
            address: '123 Main St',
            googlePlacesId: 'ChIJ123',
          },
        ]);

        const result = transformAppointmentCardData(
          appointment,
          bizMap,
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.businessName).toBe('Pet Clinic');
        expect(result.businessAddress).toBe('123 Main St');
        expect(result.googlePlacesId).toBe('ChIJ123');
      });

      it('should fallback to appointment fields for business data', () => {
        const appointment = createMockAppointment({
          businessId: 'biz-1',
          organisationName: 'Fallback Clinic',
          organisationAddress: '456 Elm St',
          businessGooglePlacesId: 'ChIJ456',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.businessName).toBe('Fallback Clinic');
        expect(result.businessAddress).toBe('456 Elm St');
        expect(result.googlePlacesId).toBe('ChIJ456');
      });

      it('should extract pet name from companions', () => {
        const appointment = createMockAppointment({companionId: 'comp-1'});
        const companions = [{id: 'comp-1', name: 'Max', profileImage: null}];

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          companions,
          {},
          mockImages,
        );

        expect(result.petName).toBe('Max');
      });

      it('should handle missing pet name', () => {
        const appointment = createMockAppointment({companionId: 'comp-unknown'});

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.petName).toBeUndefined();
      });
    });

    describe('status-based fields', () => {
      it('should detect REQUESTED status', () => {
        const appointment = createMockAppointment({status: 'REQUESTED'});

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.isRequested).toBe(true);
        expect(result.needsPayment).toBe(false);
      });

      it('should detect payment statuses', () => {
        const statuses = ['NO_PAYMENT', 'AWAITING_PAYMENT', 'PAYMENT_FAILED'];

        statuses.forEach(status => {
          const appointment = createMockAppointment({status});

          const result = transformAppointmentCardData(
            appointment,
            createBusinessMap(),
            createEmployeeMap(),
            createServiceMap(),
            [],
            {},
            mockImages,
          );

          expect(result.needsPayment).toBe(true);
        });
      });

      it('should detect CHECKED_IN status', () => {
        const appointment = createMockAppointment({status: 'CHECKED_IN'});

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.isCheckedIn).toBe(true);
        expect(result.checkInLabel).toBe('Checked in');
        expect(result.checkInDisabled).toBe(true);
      });

      it('should detect IN_PROGRESS status', () => {
        const appointment = createMockAppointment({status: 'IN_PROGRESS'});

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.isInProgress).toBe(true);
        expect(result.checkInLabel).toBe('In progress');
        expect(result.checkInDisabled).toBe(true);
      });

      it('should enable check-in for UPCOMING status', () => {
        const appointment = createMockAppointment({status: 'UPCOMING', employeeId: 'emp-1'});
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.statusAllowsActions).toBe(true);
        expect(result.checkInLabel).toBe('Check in');
        expect(result.checkInDisabled).toBe(false);
      });

      it('should disable actions when payment needed', () => {
        const appointment = createMockAppointment({
          status: 'UPCOMING',
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const resultUpcoming = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(resultUpcoming.statusAllowsActions).toBe(true);

        const appointmentNeedsPayment = createMockAppointment({
          status: 'NO_PAYMENT',
        });

        const resultPayment = transformAppointmentCardData(
          appointmentNeedsPayment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(resultPayment.statusAllowsActions).toBe(false);
      });
    });

    describe('assignment notes', () => {
      it('should show pending review note when no assigned vet', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          employeeName: null,
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.assignmentNote).toBe(
          "Your request is pending review. The business will assign a provider once it's approved.",
        );
      });

      it('should show check-in note for PAID status with assigned vet', () => {
        const appointment = createMockAppointment({
          status: 'PAID',
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.assignmentNote).toBe(
          'Check-in unlocks when you are within ~200m of the clinic and 5 minutes before start time.',
        );
      });

      it('should show check-in note for UPCOMING status with assigned vet', () => {
        const appointment = createMockAppointment({
          status: 'UPCOMING',
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.assignmentNote).toBe(
          'Check-in unlocks when you are within ~200m of the clinic and 5 minutes before start time.',
        );
      });

      it('should show check-in note for CHECKED_IN status with assigned vet', () => {
        const appointment = createMockAppointment({
          status: 'CHECKED_IN',
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.assignmentNote).toBe(
          'Check-in unlocks when you are within ~200m of the clinic and 5 minutes before start time.',
        );
      });

      it('should have no assignment note for other statuses with assigned vet', () => {
        const appointment = createMockAppointment({
          status: 'COMPLETED',
          employeeId: 'emp-1',
        });
        const empMap = createEmployeeMap([{id: 'emp-1', name: 'Dr. Smith'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          empMap,
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.assignmentNote).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle empty maps and arrays', () => {
        const appointment = createMockAppointment();

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result).toBeDefined();
        expect(result.businessName).toBe('');
        expect(result.businessAddress).toBe('');
      });

      it('should handle null/undefined service specialty', () => {
        const appointment = createMockAppointment({
          employeeId: null,
          serviceId: 'svc-1',
          type: null,
        });
        const svcMap = createServiceMap([{id: 'svc-1', name: 'Service'}]);

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          svcMap,
          [],
          {},
          mockImages,
        );

        expect(result.cardSubtitle).toBe('Awaiting vet assignment');
      });

      it('should use appointment businessPhoto when business not in map', () => {
        const appointment = createMockAppointment({
          businessId: 'biz-unknown',
          businessPhoto: 'https://example.com/photo.jpg',
        });

        const result = transformAppointmentCardData(
          appointment,
          createBusinessMap(),
          createEmployeeMap(),
          createServiceMap(),
          [],
          {},
          mockImages,
        );

        expect(result.avatarSource).toBe('https://example.com/photo.jpg');
      });
    });
  });
});
