const getModule = () => require('@/features/appointments/services/appointmentsService');
const getApiClient = () => require('@/shared/services/apiClient').default;

// --- Mocks ---
let mockOS = 'ios';
jest.mock('react-native', () => ({
  Platform: {
    get OS() { return mockOS; },
    select: jest.fn((objs) => objs[mockOS]),
  },
}));

// Mock config with trailing slash to test stripping logic
jest.mock('@/config/variables', () => ({
  API_CONFIG: {
    baseUrl: 'http://localhost:3000/',
    pmsBaseUrl: 'http://localhost:8080',
  },
}));

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  withAuthHeaders: jest.fn().mockImplementation((token) => ({ Authorization: `Bearer ${token}` })),
}));

jest.mock('@/shared/utils/dateHelpers', () => ({
  formatDateToISODate: (d: any) => {
      if (!d || d === 'invalid-date') return '';
      const date = new Date(d);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  },
}));

jest.mock('@/shared/utils/cdnHelpers', () => ({
  buildCdnUrlFromKey: (key: string) => `https://cdn.com/${key}`,
}));

describe('appointmentsService', () => {
  const mockToken = 'mock-access-token';

  beforeEach(() => {
    jest.resetModules(); // CRITICAL: Resets module state to re-evaluate top-level code
    jest.clearAllMocks();
    mockOS = 'ios';

    // Set default resolved values to prevent crashes
    const client = getApiClient();
    client.get.mockResolvedValue({ data: {} });
    client.post.mockResolvedValue({ data: {} });
    client.patch.mockResolvedValue({ data: {} });
  });

  describe('Module Level Logic (Platform & URL Normalization)', () => {
    it('should normalize localhost URLs to 10.0.2.2 for Android', async () => {
      mockOS = 'android';
      const { appointmentApi } = getModule();
      const client = getApiClient();

      await appointmentApi.listAppointments({ companionId: '1', accessToken: 'token' });

      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('10.0.2.2'),
        expect.anything()
      );
    });

    it('should keep localhost URLs as-is for iOS', async () => {
      mockOS = 'ios';
      const { appointmentApi } = getModule();
      const client = getApiClient();

      await appointmentApi.listAppointments({ companionId: '1', accessToken: 'token' });

      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('localhost'),
        expect.anything()
      );
    });
  });

  describe('Mappers (Unit Logic)', () => {
    describe('mapAppointmentFromResponse', () => {
      it('should map a fully populated appointment resource correctly', () => {
        const { mapAppointmentFromResponse } = getModule();
        const mockRaw = {
          id: 'apt-123',
          status: 'arrived',
          description: 'Sick dog',
          start: '2023-10-10T10:00:00Z',
          end: '2023-10-10T11:00:00Z',
          participant: [
            { actor: { reference: 'Patient/pet-1', display: 'Fido' } },
            {
              actor: { reference: 'Practitioner/doc-1', display: 'Dr. Smith' },
              type: [{ coding: [{ display: 'Vet' }] }]
            },
            { actor: { reference: 'Organization/org-1', display: 'Clinic' } }
          ],
          serviceType: [{ text: 'Exam', coding: [{ code: 'S1', display: 'Exam' }] }],
          extension: [
            { url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency', valueBoolean: true },
            { id: 'species', valueString: 'Dog' },
            { url: 'https://hl7.org/fhir/animal-breed', valueString: 'Lab' },
            {
                url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
                extension: [
                    { url: 'key', valueString: 'file.jpg' },
                    { url: 'contentType', valueString: 'image/jpeg' }
                ]
            }
          ],
          organisation: {
              name: 'Clinic Override',
              address: { line: ['123 Main St'], city: 'Town', state: 'CA' },
              googlePlacesId: 'gp-123',
              imageURL: 'http://img.com'
          }
        };

        const result = mapAppointmentFromResponse(mockRaw);

        expect(result.id).toBe('apt-123');
        expect(result.status).toBe('CHECKED_IN');
        expect(result.emergency).toBe(true);
        expect(result.serviceId).toBe('S1');
        expect(result.organisationName).toBe('Clinic');
        expect(result.uploadedFiles).toHaveLength(1);
        expect(result.organisationAddress).toContain('123 Main St');
      });

      it('should handle logic for address fallback', () => {
        const { mapAppointmentFromResponse } = getModule();
        // Case: Location address is empty, should fallback to Organization address
        const mockRaw = {
            location: { address: { addressLine: '   ' } }, // Empty/whitespace
            organisation: { address: { addressLine: 'Org St' } }
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.organisationAddress).toBe('Org St');
      });

      it('should resolve coordinates from mongo-style location object', () => {
        const { mapAppointmentFromResponse } = getModule();
        // Covers resolveBusinessCoordinates fallback logic
        const mockRaw = {
            location: {
                address: {
                    location: { coordinates: [-122, 37] } // [lng, lat]
                }
            }
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.businessLat).toBe(37);
        expect(result.businessLng).toBe(-122);
      });

      it('should resolve coordinates from direct lat/lng fields', () => {
        const { mapAppointmentFromResponse } = getModule();
        const mockRaw = {
            location: {
                address: { latitude: 37, longitude: -122 }
            }
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.businessLat).toBe(37);
        expect(result.businessLng).toBe(-122);
      });

      it('should handle invalid date string', () => {
          const { mapAppointmentFromResponse } = getModule();
          const result = mapAppointmentFromResponse({ start: 'invalid-date' });
          expect(result.date).toBe('');
      });
    });

    describe('mapInvoiceFromResponse', () => {
      it('should return nulls if raw data is missing', () => {
        const { mapInvoiceFromResponse } = getModule();
        const { invoice, paymentIntent } = mapInvoiceFromResponse(null);
        expect(invoice).toBeNull();
        expect(paymentIntent).toBeNull();
      });

      it('should map invoice and handle missing item totals', () => {
        const { mapInvoiceFromResponse } = getModule();
        const raw = {
            id: 'inv-1',
            // Missing 'total', should calculate from rate * qty
            items: [{ description: 'Shot', rate: 25, qty: 2 }],
            paymentIntent: {
                id: 'pi-1',
                clientSecret: 'secret',
                amount: 5000,
                currency: 'USD'
            }
        };

        const { invoice } = mapInvoiceFromResponse(raw);

        expect(invoice?.id).toBe('inv-1');
        expect(invoice?.items[0].lineTotal).toBe(50); // 25 * 2
        expect(invoice?.subtotal).toBe(50); // Sum of lines fallback

      });

      it('should map invoice using extensions for IDs and URLs', () => {
        const { mapInvoiceFromResponse } = getModule();
        const raw = {
            totalAmount: 100,
            extension: [
                { url: 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id', valueString: 'pi-ext' },
                { url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id', valueString: 'apt-ext' },
                { url: 'https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status', valueString: 'DRAFT' }
            ],
            clientSecret: 'secret-root'
        };
        const { invoice, paymentIntent } = mapInvoiceFromResponse(raw);

        expect(paymentIntent?.paymentIntentId).toBe('pi-ext');
        expect(invoice?.appointmentId).toBe('apt-ext');
        expect(invoice?.status).toBe('DRAFT');
      });
    });

    describe('mapBusinessFromResponse', () => {
      it('should map business with specialities and services', () => {
        const { mapBusinessFromResponse } = getModule();
        const raw = {
            org: {
                id: 'biz-1',
                name: 'Pet Shop',
                type: 'GROOMER',
                address: [{ text: '123 St', latitude: 10, longitude: 20 }],
                telecom: [{ system: 'url', value: 'http://site.com' }, { system: 'phone', value: '555' }]
            },
            distanceInMeters: 1609.344,
            specialitiesWithServices: [
                {
                    name: 'Grooming',
                    services: [{ name: 'Bath', cost: 50 }]
                }
            ]
        };

        const { business, services } = mapBusinessFromResponse(raw);

        expect(business.category).toBe('groomer');
        expect(business.distanceMi).toBe(1);
        expect(business.lat).toBe(10);
        expect(services).toHaveLength(1);
        expect(services[0].basePrice).toBe(50);
      });

      it('should extract photo from extensions if top level fields missing', () => {
        const { mapBusinessFromResponse } = getModule();
        const raw = {
            org: {
                extension: [
                    {
                        url: 'https://example.org/fhir/StructureDefinition/organisation-image',
                        valueUrl: 'http://ext-image.com'
                    }
                ]
            }
        };
        const { business } = mapBusinessFromResponse(raw);
        expect(business.photo).toBe('http://ext-image.com');
      });

      it('should handle fallback categories correctly', () => {
          const { mapBusinessFromResponse } = getModule();
          expect(mapBusinessFromResponse({ org: { type: 'BOARDING' } }).business.category).toBe('boarder');
          expect(mapBusinessFromResponse({ org: { type: 'BREEDER' } }).business.category).toBe('breeder');
          expect(mapBusinessFromResponse({ org: { type: 'UNKNOWN' } }).business.category).toBe('hospital');
      });
    });
  });

  describe('Service Methods (API Integration)', () => {

    it('listAppointments calls GET', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { data: [{ id: '1' }] } });

        const result = await appointmentApi.listAppointments({ companionId: 'c1', accessToken: mockToken });

        expect(client.get).toHaveBeenCalledWith(
            expect.stringContaining('/fhir/v1/appointment/mobile/companion/c1'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${mockToken}` }) })
        );
        expect(result).toHaveLength(1);
    });

    it('getAppointment calls GET', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { data: { id: '1' } } });
        const result = await appointmentApi.getAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.id).toBe('1');
    });

    it('checkInAppointment calls PATCH', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.patch.mockResolvedValue({ data: { id: '1', status: 'arrived' } });
        const result = await appointmentApi.checkInAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(client.patch).toHaveBeenCalledWith(
            expect.stringContaining('/checkin'),
            undefined,
            expect.anything()
        );
        expect(result.status).toBe('CHECKED_IN');
    });

    it('fetchNearbyBusinesses calls GET', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { data: [{ org: { name: 'Vet' } }] } });
        await appointmentApi.fetchNearbyBusinesses({ lat: 10, lng: 20, accessToken: mockToken });
        expect(client.get).toHaveBeenCalledWith(
            expect.stringContaining('lat=10&lng=20'),
            expect.anything()
        );
    });

    it('searchBusinessesByService calls GET (no token)', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { data: [] } });
        await appointmentApi.searchBusinessesByService({ serviceName: 'Cut', lat: 10, lng: 10 });
        expect(client.get).toHaveBeenCalledWith(
            expect.stringContaining('serviceName=Cut'),
            undefined
        );
    });

    it('searchBusinessesByService calls GET with token', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { data: [] } });
        await appointmentApi.searchBusinessesByService({ serviceName: 'Cut', lat: 10, lng: 10, accessToken: mockToken });
        expect(client.get).toHaveBeenCalledWith(
            expect.stringContaining('serviceName=Cut'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${mockToken}` }) })
        );
    });

    it('fetchBookableSlots calls POST', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.post.mockResolvedValue({ data: { data: { windows: [] } } });
        await appointmentApi.fetchBookableSlots({ serviceId: 's1', organisationId: 'o1', date: '2023-01-01' });
        expect(client.post).toHaveBeenCalledWith(
            expect.stringContaining('/bookable-slots'),
            { serviceId: 's1', organisationId: 'o1', date: '2023-01-01' },
            undefined
        );
    });

    it('bookAppointment handles success response', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        const mockResponse = {
            appointment: { id: 'a1' },
            invoice: { id: 'i1', total: 100 },
            paymentIntent: { id: 'pi-1', amount: 100, clientSecret: 'sec' }
        };
        client.post.mockResolvedValue({ data: { data: mockResponse } });

        const result = await appointmentApi.bookAppointment({ payload: {}, accessToken: mockToken });

        expect(result.appointment.id).toBe('a1');
        expect(result.invoice?.id).toBe('i1');
        expect(result.paymentIntent?.paymentIntentId).toBe('pi-1');
    });

    it('bookAppointment handles flat structure fallback', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        const mockResponse = {
            appointment: { id: 'a1' },
            invoice: {
                id: 'i1',
                paymentIntent: { id: 'pi-invoice', amount: 50, clientSecret: 'sec' }
            }
        };
        client.post.mockResolvedValue({ data: mockResponse });

        const result = await appointmentApi.bookAppointment({ payload: {}, accessToken: mockToken });
        expect(result.paymentIntent?.paymentIntentId).toBe('pi-invoice');
    });

    it('rescheduleAppointment calls PATCH', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.patch.mockResolvedValue({ data: { id: 'a1' } });
        await appointmentApi.rescheduleAppointment({
            appointmentId: 'a1', startTime: '2023-01-01', endTime: '2023-01-01',
            isEmergency: true, concern: 'Pain', accessToken: mockToken
        });
        expect(client.patch).toHaveBeenCalledWith(
            expect.stringContaining('/reschedule'),
            expect.objectContaining({ isEmergency: true }),
            expect.anything()
        );
    });

    it('fetchInvoiceForAppointment handles array response', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        const rawInvoice = { id: 'i1', appointmentId: 'a1' };
        client.get.mockResolvedValue({ data: { data: [rawInvoice] } });

        const result = await appointmentApi.fetchInvoiceForAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.invoice?.id).toBe('i1');
    });

    it('fetchInvoiceForAppointment returns null if empty', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: [] });
        const result = await appointmentApi.fetchInvoiceForAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.invoice).toBeNull();
    });

    it('fetchInvoiceForAppointment handles missing extensions gracefully', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        const rawInvoice = { id: 'i1' }; // No extensions
        client.get.mockResolvedValue({ data: { data: [rawInvoice] } });

        const result = await appointmentApi.fetchInvoiceForAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.invoice?.id).toBe('i1');
        expect(result.invoice?.appointmentId).toBe('a1'); // Fallback to arg
    });

    it('createPaymentIntent calls POST', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.post.mockResolvedValue({ data: { paymentIntentId: 'pi-new' } });
        const result = await appointmentApi.createPaymentIntent({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.paymentIntentId).toBe('pi-new');
    });

    it('createPaymentIntent handles fallback logic', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.post.mockResolvedValue({ data: {} });
        const result = await appointmentApi.createPaymentIntent({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.paymentIntentId).toBe('pi-a1');
    });

    it('cancelAppointment calls PATCH', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.patch.mockResolvedValue({ data: { id: 'a1', status: 'cancelled' } });
        const result = await appointmentApi.cancelAppointment({ appointmentId: 'a1', accessToken: mockToken });
        expect(result.status).toBe('CANCELLED');
    });

    it('rateOrganisation calls POST', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.post.mockResolvedValue({ data: 'ok' });
        const result = await appointmentApi.rateOrganisation({ organisationId: 'o1', rating: 5, review: 'Good', accessToken: mockToken });
        expect(result).toBe('ok');
    });

    it('getOrganisationRatingStatus returns status', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { hasRated: { isRated: 1, rating: 4 } } });
        const result = await appointmentApi.getOrganisationRatingStatus({ organisationId: 'o1', accessToken: mockToken });
        expect(result.isRated).toBe(true);
        expect(result.rating).toBe(4);
    });

    it('getOrganisationRatingStatus handles flat structure', async () => {
        const { appointmentApi } = getModule();
        const client = getApiClient();
        client.get.mockResolvedValue({ data: { isRated: true } });
        const result = await appointmentApi.getOrganisationRatingStatus({ organisationId: 'o1', accessToken: mockToken });
        expect(result.isRated).toBe(true);
    });
  });
});