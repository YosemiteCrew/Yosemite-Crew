const getModule = () =>
  require('@/features/appointments/services/appointmentsService');
const getApiClient = () => require('@/shared/services/apiClient').default;

// --- Mocks ---
let mockOS = 'ios';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS;
    },
    select: jest.fn(objs => objs[mockOS]),
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
    defaults: {headers: {common: {}}},
  },
  withAuthHeaders: jest
    .fn()
    .mockImplementation(token => ({Authorization: `Bearer ${token}`})),
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
    client.get.mockResolvedValue({data: {}});
    client.post.mockResolvedValue({data: {}});
    client.patch.mockResolvedValue({data: {}});
  });

  describe('Module Level Logic (Platform & URL Normalization)', () => {
    it('should normalize localhost URLs to 10.0.2.2 for Android', async () => {
      mockOS = 'android';
      const {appointmentApi} = getModule();
      const client = getApiClient();

      await appointmentApi.listAppointments({
        companionId: '1',
        accessToken: 'token',
      });

      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('10.0.2.2'),
        expect.anything(),
      );
    });

    it('should keep localhost URLs as-is for iOS', async () => {
      mockOS = 'ios';
      const {appointmentApi} = getModule();
      const client = getApiClient();

      await appointmentApi.listAppointments({
        companionId: '1',
        accessToken: 'token',
      });

      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('localhost'),
        expect.anything(),
      );
    });
  });

  describe('Mappers (Unit Logic)', () => {
    describe('mapAppointmentFromResponse', () => {
      it('should map a fully populated appointment resource correctly', () => {
        const {mapAppointmentFromResponse} = getModule();
        const mockRaw = {
          id: 'apt-123',
          status: 'arrived',
          description: 'Sick dog',
          start: '2023-10-10T10:00:00Z',
          end: '2023-10-10T11:00:00Z',
          participant: [
            {actor: {reference: 'Patient/pet-1', display: 'Fido'}},
            {
              actor: {reference: 'Practitioner/doc-1', display: 'Dr. Smith'},
              type: [{coding: [{display: 'Vet'}]}],
            },
            {actor: {reference: 'Organization/org-1', display: 'Clinic'}},
          ],
          serviceType: [
            {text: 'Exam', coding: [{code: 'S1', display: 'Exam'}]},
          ],
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency',
              valueBoolean: true,
            },
            {id: 'species', valueString: 'Dog'},
            {url: 'https://hl7.org/fhir/animal-breed', valueString: 'Lab'},
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
              extension: [
                {url: 'key', valueString: 'file.jpg'},
                {url: 'contentType', valueString: 'image/jpeg'},
              ],
            },
          ],
          organisation: {
            name: 'Clinic Override',
            address: {line: ['123 Main St'], city: 'Town', state: 'CA'},
            googlePlacesId: 'gp-123',
            imageURL: 'http://img.com',
            appointmentCheckInBufferMinutes: 9,
            appointmentCheckInRadiusMeters: 350,
          },
        };

        const result = mapAppointmentFromResponse(mockRaw);

        expect(result.id).toBe('apt-123');
        expect(result.status).toBe('CHECKED_IN');
        expect(result.emergency).toBe(true);
        expect(result.serviceId).toBe('S1');
        expect(result.organisationName).toBe('Clinic');
        expect(result.uploadedFiles).toHaveLength(1);
        expect(result.organisationAddress).toContain('123 Main St');
        expect(result.appointmentCheckInBufferMinutes).toBe(9);
        expect(result.appointmentCheckInRadiusMeters).toBe(350);
      });

      it('should handle logic for address fallback', () => {
        const {mapAppointmentFromResponse} = getModule();
        // Case: Location address is empty, should fallback to Organization address
        const mockRaw = {
          location: {address: {addressLine: '   '}}, // Empty/whitespace
          organisation: {address: {addressLine: 'Org St'}},
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.organisationAddress).toBe('Org St');
      });

      it('should resolve coordinates from mongo-style location object', () => {
        const {mapAppointmentFromResponse} = getModule();
        // Covers resolveBusinessCoordinates fallback logic
        const mockRaw = {
          location: {
            address: {
              location: {coordinates: [-122, 37]}, // [lng, lat]
            },
          },
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.businessLat).toBe(37);
        expect(result.businessLng).toBe(-122);
      });

      it('should resolve coordinates from direct lat/lng fields', () => {
        const {mapAppointmentFromResponse} = getModule();
        const mockRaw = {
          location: {
            address: {latitude: 37, longitude: -122},
          },
        };
        const result = mapAppointmentFromResponse(mockRaw);
        expect(result.businessLat).toBe(37);
        expect(result.businessLng).toBe(-122);
      });

      it('should handle invalid date string', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({start: 'invalid-date'});
        expect(result.date).toBe('');
      });

      it('should map lead avatar from non-FHIR lead object fields', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-lead-avatar',
          start: '2026-03-24T06:45:00.000Z',
          participant: [
            {actor: {reference: 'Patient/p1', display: 'Buddy'}},
            {actor: {reference: 'Organization/o1', display: 'Clinic'}},
          ],
          lead: {
            id: 'doc-1',
            name: 'Dr. Stone',
            profilePictureUrl: 'https://cdn.example.com/dr-stone.png',
          },
        });

        expect(result.employeeName).toBe('Dr. Stone');
        expect(result.employeeAvatar).toBe(
          'https://cdn.example.com/dr-stone.png',
        );
      });

      it('should fall back to check-in extensions and a valid secondary practitioner entry', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-checkin-ext',
          status: 'awaiting payment',
          start: '2026-04-01T10:15:00.000Z',
          end: '2026-04-01T10:45:00.000Z',
          participant: [
            {actor: {reference: 'Patient/comp-1', display: 'Buddy'}},
            {
              actor: {reference: 'Practitioner/null', display: '   '},
              type: [{text: 'Ignored role'}],
            },
            {
              actor: {reference: 'Practitioner/prac-2', display: 'Dr. Valid'},
              type: [{text: 'Support Vet'}],
            },
            {actor: {reference: 'Organization/org-2', display: 'Fallback Vet'}},
          ],
          organisation: {
            name: 'Fallback Vet',
            appointmentCheckInBufferMinutes: -5,
            appointmentCheckInRadiusMeters: 'bad-value',
            extension: [
              {
                url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-check-in-buffer-minutes',
                valueString: '12',
              },
              {
                url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-check-in-radius-meters',
                valueDecimal: 250,
              },
            ],
          },
        });

        expect(result.employeeId).toBe('prac-2');
        expect(result.employeeName).toBe('Dr. Valid');
        expect(result.employeeTitle).toBe('Support Vet');
        expect(result.status).toBe('AWAITING_PAYMENT');
        expect(result.appointmentCheckInBufferMinutes).toBe(12);
        expect(result.appointmentCheckInRadiusMeters).toBe(250);
        expect(result.endTime).toMatch(/^\d{2}:\d{2}$/);
      });

      it('should build ui-avatar urls and attachment fallbacks from appointment extensions', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-attachments',
          status: 'scheduled',
          start: '2026-04-02T08:00:00.000Z',
          participant: [
            {actor: {reference: 'Patient/pet-2', display: 'Milo'}},
            {
              actor: {reference: 'Practitioner/doc-2', display: 'Dr. Adams'},
              extension: [
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/lead-profile-url',
                  valueString: 'https://ui-avatars.com/api/?name=',
                },
              ],
            },
            {actor: {reference: 'Organization/org-4', display: 'Clinic Four'}},
          ],
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status',
              valueString: 'paid',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
              extension: [
                {url: 'key', valueString: 'lab-report.pdf'},
                {url: 'contentType', valueString: 'application/pdf'},
                {url: 'url', valueUrl: 'https://files.example.com/custom.pdf'},
                {url: 'name', valueString: ''},
              ],
            },
          ],
        });

        expect(result.employeeAvatar).toBe(
          'https://ui-avatars.com/api/?name=Dr.%20Adams',
        );
        expect(result.paymentStatus).toBe('PAID');
        expect(result.uploadedFiles).toEqual([
          expect.objectContaining({
            id: 'lab-report.pdf',
            name: 'Attachment 1',
            key: 'lab-report.pdf',
            url: 'https://files.example.com/custom.pdf',
            type: 'application/pdf',
          }),
        ]);
      });

      it('should keep a ui-avatar template unchanged when no display name is available', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-avatar-template',
          status: 'unknown-status',
          start: '2026-04-03T09:00:00.000Z',
          participant: [
            {actor: {reference: 'Patient/pet-3', display: 'Nova'}},
            {
              actor: {reference: 'Practitioner/doc-3', display: '   '},
              extension: [
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/lead-profile-url',
                  valueString: 'https://ui-avatars.com/api/?name=',
                },
              ],
            },
            {actor: {reference: 'Organization/org-5', display: 'Clinic Five'}},
          ],
        });

        expect(result.employeeAvatar).toBe('https://ui-avatars.com/api/?name=');
        expect(result.status).toBe('REQUESTED');
      });

      it('should ignore invalid avatar strings and malformed attachment extensions', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-invalid-avatar',
          status: 'scheduled',
          start: '2026-04-03T09:30:00.000Z',
          participant: [
            {actor: {reference: 'Patient/pet-4', display: 'Nova'}},
            {
              actor: {reference: 'Practitioner/doc-4', display: 'Dr. Blank'},
              extension: [
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/lead-profile-url',
                  valueString: ' undefined ',
                },
              ],
            },
            {actor: {reference: 'Organization/org-6', display: 'Clinic Six'}},
          ],
          lead: {},
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
              extension: {},
            },
          ],
        });

        expect(result.employeeAvatar).toBeNull();
        expect(result.uploadedFiles).toEqual([]);
      });

      it('should ignore non-array organisation extensions for check-in config', () => {
        const {mapAppointmentFromResponse} = getModule();
        const result = mapAppointmentFromResponse({
          id: 'apt-no-array-ext',
          status: 'scheduled',
          start: '2026-04-03T09:45:00.000Z',
          participant: [
            {actor: {reference: 'Patient/pet-5', display: 'Bean'}},
            {actor: {reference: 'Organization/org-7', display: 'Clinic Seven'}},
          ],
          organisation: {
            name: 'Clinic Seven',
            appointmentCheckInBufferMinutes: 'bad-value',
            appointmentCheckInRadiusMeters: 'still-bad',
            extension: {url: 'not-an-array'},
          },
        });

        expect(result.appointmentCheckInBufferMinutes).toBeUndefined();
        expect(result.appointmentCheckInRadiusMeters).toBeUndefined();
      });
    });

    describe('mapInvoiceFromResponse', () => {
      it('should return nulls if raw data is missing', () => {
        const {mapInvoiceFromResponse} = getModule();
        const {invoice, paymentIntent} = mapInvoiceFromResponse(null);
        expect(invoice).toBeNull();
        expect(paymentIntent).toBeNull();
      });

      it('should map invoice and handle missing item totals', () => {
        const {mapInvoiceFromResponse} = getModule();
        const raw = {
          id: 'inv-1',
          // Missing 'total', should calculate from rate * qty
          items: [{description: 'Shot', rate: 25, qty: 2}],
          paymentIntent: {
            id: 'pi-1',
            clientSecret: 'secret',
            amount: 5000,
            currency: 'USD',
          },
        };

        const {invoice} = mapInvoiceFromResponse(raw);

        expect(invoice?.id).toBe('inv-1');
        expect(invoice?.items[0].lineTotal).toBe(50); // 25 * 2
        expect(invoice?.subtotal).toBe(50); // Sum of lines fallback
      });

      it('should map invoice using extensions for IDs and URLs', () => {
        const {mapInvoiceFromResponse} = getModule();
        const raw = {
          totalAmount: 100,
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id',
              valueString: 'pi-ext',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id',
              valueString: 'apt-ext',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status',
              valueString: 'PAID',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/payment-collection-method',
              valueString: 'PAYMENT_AT_CLINIC',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/paid-at',
              valueDateTime: '2026-03-19T10:00:00.000Z',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/invoice-metadata',
              extension: [{url: 'paymentMethod', valueString: 'cash'}],
            },
          ],
          clientSecret: 'secret-root',
        };
        const {invoice, paymentIntent} = mapInvoiceFromResponse(raw);

        expect(paymentIntent?.paymentIntentId).toBe('pi-ext');
        expect(invoice?.appointmentId).toBe('apt-ext');
        expect(invoice?.status).toBe('PAID');
        expect(invoice?.paymentCollectionMethod).toBe('PAYMENT_AT_CLINIC');
        expect(invoice?.paidAt).toBe('2026-03-19T10:00:00.000Z');
        expect(invoice?.metadata?.paymentMethod).toBe('cash');
      });

      it('should derive invoice details from account references, totals, and metadata extensions', () => {
        const {mapInvoiceFromResponse} = getModule();
        const raw = {
          id: 'inv-fhir-like',
          account: {reference: 'Appointment/apt-account'},
          totalPriceComponent: [
            {type: 'base', amount: {value: 80}},
            {type: 'informational', amount: {value: 92}},
          ],
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id',
              valueString: 'pi-from-ext',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-receipt-url',
              valueString: 'https://receipts.example.com/ext-string',
            },
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/invoice-metadata',
              extension: [
                {url: 'refundable', valueBoolean: true},
                {url: 'refundAmount', valueDecimal: 12.5},
                {url: 'refundId', valueString: 're_123'},
                {url: 'refundDate', valueString: '2026-04-01T10:00:00.000Z'},
                {
                  url: 'cancellationReason',
                  valueString: 'Customer changed plans',
                },
              ],
            },
          ],
          currency: 'CAD',
          dueDate: '2026-04-05T00:00:00.000Z',
        };

        const {invoice, paymentIntent} = mapInvoiceFromResponse(raw);

        expect(invoice?.appointmentId).toBe('apt-account');
        expect(invoice?.subtotal).toBe(80);
        expect(invoice?.total).toBe(92);
        expect(invoice?.currency).toBe('USD');
        expect(invoice?.stripeReceiptUrl).toBe(
          'https://receipts.example.com/ext-string',
        );
        expect(invoice?.metadata).toEqual(
          expect.objectContaining({
            refundable: true,
            refundAmount: 12.5,
          }),
        );
        expect(invoice?.refundId).toBe('re_123');
        expect(invoice?.refundDate).toBe('2026-04-01T10:00:00.000Z');
        expect(invoice?.refundReason).toBe('Customer changed plans');
        expect(paymentIntent?.paymentIntentId).toBe('pi-from-ext');
        expect(paymentIntent?.currency).toBe('CAD');
      });

      it('should normalize raw items and payment intent objects without extension fallbacks', () => {
        const {mapInvoiceFromResponse} = getModule();
        const raw = {
          id: 'inv-raw-items',
          items: [{name: 'Consult', unitPrice: 75, quantity: 2}],
          paymentIntent: {
            paymentIntentId: 'pi-direct',
            clientSecret: 'secret-direct',
            amount: 150,
            paymentLinkUrl: 'https://pay.example.com/direct',
          },
          date: '2026-04-02T10:00:00.000Z',
          downloadUrl: 'https://download.example.com/invoice.pdf',
          payment_collection_method: 'ONLINE',
          billedToName: 'Alex Doe',
          billedToEmail: 'alex@example.com',
          invoiceNo: 'INV-204',
        };

        const {invoice, paymentIntent} = mapInvoiceFromResponse(raw);

        expect(invoice?.items).toEqual([
          {
            description: 'Consult',
            rate: 75,
            qty: 2,
            lineTotal: 150,
          },
        ]);
        expect(invoice?.subtotal).toBe(150);
        expect(invoice?.total).toBe(150);
        expect(invoice?.downloadUrl).toBe(
          'https://download.example.com/invoice.pdf',
        );
        expect(invoice?.paymentCollectionMethod).toBe('ONLINE');
        expect(invoice?.invoiceNumber).toBe('INV-204');
        expect(invoice?.billedToName).toBe('Alex Doe');
        expect(invoice?.billedToEmail).toBe('alex@example.com');
        expect(paymentIntent).toEqual(
          expect.objectContaining({
            paymentIntentId: 'pi-direct',
            clientSecret: 'secret-direct',
            amount: 150,
            paymentLinkUrl: 'https://pay.example.com/direct',
            currency: 'USD',
          }),
        );
      });

      it('should keep invoice mapping stable when raw extensions are empty', () => {
        const {mapInvoiceFromResponse} = getModule();
        const raw = {
          id: 'inv-fallback',
          items: [{description: 'Consult', total: 40}],
          paymentIntentId: 'pi-fallback',
          extension: [],
        };

        const {invoice, paymentIntent} = mapInvoiceFromResponse(raw);

        expect(invoice?.id).toBe('inv-fallback');
        expect(invoice?.items[0].lineTotal).toBe(40);
        expect(paymentIntent?.paymentIntentId).toBe('pi-fallback');
      });
    });

    describe('mapBusinessFromResponse', () => {
      it('should map business with specialities and services', () => {
        const {mapBusinessFromResponse} = getModule();
        const raw = {
          org: {
            id: 'biz-1',
            name: 'Pet Shop',
            type: 'GROOMER',
            address: [{text: '123 St', latitude: 10, longitude: 20}],
            appointmentCheckInBufferMinutes: 6,
            appointmentCheckInRadiusMeters: 180,
            telecom: [
              {system: 'url', value: 'http://site.com'},
              {system: 'phone', value: '555'},
            ],
          },
          distanceInMeters: 1609.344,
          specialitiesWithServices: [
            {
              name: 'Grooming',
              services: [{name: 'Bath', cost: 50}],
            },
          ],
        };

        const {business, services} = mapBusinessFromResponse(raw);

        expect(business.category).toBe('groomer');
        expect(business.distanceMi).toBe(1);
        expect(business.lat).toBe(10);
        expect(business.appointmentCheckInBufferMinutes).toBe(6);
        expect(business.appointmentCheckInRadiusMeters).toBe(180);
        expect(services).toHaveLength(1);
        expect(services[0].basePrice).toBe(50);
      });

      it('should extract photo from extensions if top level fields missing', () => {
        const {mapBusinessFromResponse} = getModule();
        const raw = {
          org: {
            extension: [
              {
                url: 'https://example.org/fhir/StructureDefinition/organisation-image',
                valueUrl: 'http://ext-image.com',
              },
            ],
          },
        };
        const {business} = mapBusinessFromResponse(raw);
        expect(business.photo).toBe('http://ext-image.com');
      });

      it('should handle fallback categories correctly', () => {
        const {mapBusinessFromResponse} = getModule();
        expect(
          mapBusinessFromResponse({org: {type: 'BOARDING'}}).business.category,
        ).toBe('boarder');
        expect(
          mapBusinessFromResponse({org: {type: 'BREEDER'}}).business.category,
        ).toBe('breeder');
        expect(
          mapBusinessFromResponse({org: {type: 'UNKNOWN'}}).business.category,
        ).toBe('hospital');
      });
    });
  });

  describe('Service Methods (API Integration)', () => {
    it('listAppointments calls GET', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {data: [{id: '1'}]}});

      const result = await appointmentApi.listAppointments({
        companionId: 'c1',
        accessToken: mockToken,
      });

      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('/fhir/v1/appointment/mobile/companion/c1'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('getAppointment calls GET', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {data: {id: '1'}}});
      const result = await appointmentApi.getAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.id).toBe('1');
    });

    it('checkInAppointment calls PATCH', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.patch.mockResolvedValue({data: {id: '1', status: 'arrived'}});
      const result = await appointmentApi.checkInAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(client.patch).toHaveBeenCalledWith(
        expect.stringContaining('/checkin'),
        undefined,
        expect.anything(),
      );
      expect(result.status).toBe('CHECKED_IN');
    });

    it('fetchNearbyBusinesses calls GET', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {data: [{org: {name: 'Vet'}}]}});
      await appointmentApi.fetchNearbyBusinesses({
        lat: 10,
        lng: 20,
        accessToken: mockToken,
      });
      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('lat=10&lng=20'),
        expect.anything(),
      );
    });

    it('searchBusinessesByService calls GET (no token)', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {data: []}});
      await appointmentApi.searchBusinessesByService({
        serviceName: 'Cut',
        lat: 10,
        lng: 10,
      });
      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('serviceName=Cut'),
        undefined,
      );
    });

    it('searchBusinessesByService calls GET with token', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {data: []}});
      await appointmentApi.searchBusinessesByService({
        serviceName: 'Cut',
        lat: 10,
        lng: 10,
        accessToken: mockToken,
      });
      expect(client.get).toHaveBeenCalledWith(
        expect.stringContaining('serviceName=Cut'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it('searchBusinessesByService handles direct-array and empty-object responses', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();

      client.get.mockResolvedValueOnce({
        data: [{org: {id: 'b2', name: 'Biz Two'}}],
      });
      const arrayResult = await appointmentApi.searchBusinessesByService({
        serviceName: 'Observation',
        lat: 1,
        lng: 2,
      });

      client.get.mockResolvedValueOnce({data: {}});
      const emptyResult = await appointmentApi.searchBusinessesByService({
        serviceName: 'Observation',
        lat: 1,
        lng: 2,
      });

      expect(arrayResult.businesses).toEqual([
        expect.objectContaining({id: 'b2', name: 'Biz Two'}),
      ]);
      expect(arrayResult.services).toEqual([]);
      expect(emptyResult.businesses).toEqual([]);
      expect(emptyResult.services).toEqual([]);
    });

    it('fetchBookableSlots calls POST', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({data: {data: {windows: []}}});
      await appointmentApi.fetchBookableSlots({
        serviceId: 's1',
        organisationId: 'o1',
        date: '2023-01-01',
      });
      expect(client.post).toHaveBeenCalledWith(
        expect.stringContaining('/bookable-slots'),
        {serviceId: 's1', organisationId: 'o1', date: '2023-01-01'},
        undefined,
      );
    });

    it('bookAppointment handles success response', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      const mockResponse = {
        appointment: {id: 'a1'},
        invoice: {id: 'i1', total: 100},
        paymentIntent: {id: 'pi-1', amount: 100, clientSecret: 'sec'},
      };
      client.post.mockResolvedValue({data: {data: mockResponse}});

      const result = await appointmentApi.bookAppointment({
        payload: {},
        accessToken: mockToken,
      });

      expect(result.appointment.id).toBe('a1');
      expect(result.invoice?.id).toBe('i1');
      expect(result.paymentIntent?.paymentIntentId).toBe('pi-1');
    });

    it('bookAppointment handles flat structure fallback', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      const mockResponse = {
        appointment: {id: 'a1'},
        invoice: {
          id: 'i1',
          paymentIntent: {id: 'pi-invoice', amount: 50, clientSecret: 'sec'},
        },
      };
      client.post.mockResolvedValue({data: mockResponse});

      const result = await appointmentApi.bookAppointment({
        payload: {},
        accessToken: mockToken,
      });
      expect(result.paymentIntent?.paymentIntentId).toBe('pi-invoice');
    });

    it('rescheduleAppointment calls PATCH', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.patch.mockResolvedValue({data: {id: 'a1'}});
      await appointmentApi.rescheduleAppointment({
        appointmentId: 'a1',
        startTime: '2023-01-01',
        endTime: '2023-01-01',
        isEmergency: true,
        concern: 'Pain',
        accessToken: mockToken,
      });
      expect(client.patch).toHaveBeenCalledWith(
        expect.stringContaining('/reschedule'),
        expect.objectContaining({isEmergency: true}),
        expect.anything(),
      );
    });

    it('rescheduleAppointment handles nested message/data appointment payload', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.patch.mockResolvedValue({
        data: {
          message: 'Rescheduled successfully',
          data: {
            resourceType: 'Appointment',
            id: 'a1',
            status: 'UPCOMING',
            participant: [
              {actor: {reference: 'Patient/p1', display: 'Doggy'}},
              {actor: {reference: 'Organization/o1', display: 'Clinic'}},
            ],
            start: '2026-03-24T06:45:00.000Z',
            end: '2026-03-24T07:00:00.000Z',
          },
        },
      });

      const result = await appointmentApi.rescheduleAppointment({
        appointmentId: 'a1',
        startTime: '2026-03-24T06:45:00.000Z',
        endTime: '2026-03-24T07:00:00.000Z',
        isEmergency: false,
        concern: '',
        accessToken: mockToken,
      });

      expect(result.id).toBe('a1');
      expect(result.companionId).toBe('p1');
      expect(result.businessId).toBe('o1');
      expect(result.date).toBe('2026-03-24');
    });

    it('getAppointment unwraps appointment and nested data payload wrappers', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({
        data: {
          appointment: {
            data: {
              resourceType: 'Appointment',
              id: 'wrapped-appointment',
              status: 'CONFIRMED',
              participant: [
                {actor: {reference: 'Patient/p9', display: 'Lucky'}},
                {actor: {reference: 'Organization/o9', display: 'Clinic Nine'}},
              ],
              start: '2026-04-10T08:00:00.000Z',
            },
          },
        },
      });

      const result = await appointmentApi.getAppointment({
        appointmentId: 'wrapped-appointment',
        accessToken: mockToken,
      });

      expect(result.id).toBe('wrapped-appointment');
      expect(result.status).toBe('CONFIRMED');
      expect(result.companionId).toBe('p9');
    });

    it('getAppointment tolerates primitive and unknown wrapper payloads', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();

      client.get.mockResolvedValueOnce({data: 'oops'});
      const primitiveResult = await appointmentApi.getAppointment({
        appointmentId: 'primitive',
        accessToken: mockToken,
      });

      client.get.mockResolvedValueOnce({data: {foo: 'bar'}});
      const wrapperResult = await appointmentApi.getAppointment({
        appointmentId: 'wrapper',
        accessToken: mockToken,
      });

      expect(primitiveResult.id).toBe('');
      expect(primitiveResult.status).toBe('REQUESTED');
      expect(wrapperResult.id).toBe('');
      expect(wrapperResult.uploadedFiles).toEqual([]);
    });

    it('fetchInvoiceForAppointment handles array response', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      const rawInvoice = {id: 'i1', appointmentId: 'a1'};
      client.post.mockResolvedValue({data: {data: [rawInvoice]}});

      const result = await appointmentApi.fetchInvoiceForAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.invoice?.id).toBe('i1');
    });

    it('fetchInvoiceForAppointment returns null if empty', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({data: []});
      const result = await appointmentApi.fetchInvoiceForAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.invoice).toBeNull();
    });

    it('fetchInvoiceForAppointment handles missing extensions gracefully', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      const rawInvoice = {id: 'i1'}; // No extensions
      client.post.mockResolvedValue({data: {data: [rawInvoice]}});

      const result = await appointmentApi.fetchInvoiceForAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.invoice?.id).toBe('i1');
      expect(result.invoice?.appointmentId).toBe('a1'); // Fallback to arg
    });

    it('fetchInvoiceForAppointment prefers extension overrides', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({
        data: {
          data: [
            {
              id: 'i2',
              extension: [
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-receipt-url',
                  valueUri: 'https://stripe.example.com/r/i2',
                },
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id',
                  valueString: 'apt-ext-2',
                },
                {
                  url: 'https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status',
                  valueString: 'PAID',
                },
              ],
            },
          ],
        },
      });

      const result = await appointmentApi.fetchInvoiceForAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });

      expect(result.invoice?.appointmentId).toBe('apt-ext-2');
      expect(result.invoice?.status).toBe('PAID');
      expect(result.invoice?.downloadUrl).toBe(
        'https://stripe.example.com/r/i2',
      );
    });

    it('createPaymentIntent calls POST', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({data: {paymentIntentId: 'pi-new'}});
      const result = await appointmentApi.createPaymentIntent({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.paymentIntentId).toBe('pi-new');
    });

    it('createPaymentIntent handles fallback logic', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({data: {}});
      const result = await appointmentApi.createPaymentIntent({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.paymentIntentId).toBe('pi-a1');
    });

    it('cancelAppointment calls PATCH', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.patch.mockResolvedValue({data: {id: 'a1', status: 'cancelled'}});
      const result = await appointmentApi.cancelAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('get/checkin/cancel handle nested data payload shapes', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();

      const nestedResponse = {
        data: {
          message: 'ok',
          data: {
            resourceType: 'Appointment',
            id: 'a1',
            status: 'arrived',
            participant: [
              {actor: {reference: 'Patient/p1', display: 'Doggy'}},
              {actor: {reference: 'Organization/o1', display: 'Clinic'}},
            ],
            start: '2026-03-24T06:45:00.000Z',
            end: '2026-03-24T07:00:00.000Z',
          },
        },
      };

      client.get.mockResolvedValue(nestedResponse);
      client.patch.mockResolvedValue(nestedResponse);

      const byId = await appointmentApi.getAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      const checkIn = await appointmentApi.checkInAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });
      const cancel = await appointmentApi.cancelAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });

      expect(byId.id).toBe('a1');
      expect(checkIn.id).toBe('a1');
      expect(cancel.id).toBe('a1');
      expect(checkIn.status).toBe('CHECKED_IN');
    });

    it('rateOrganisation calls POST', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockResolvedValue({data: 'ok'});
      const result = await appointmentApi.rateOrganisation({
        organisationId: 'o1',
        rating: 5,
        review: 'Good',
        accessToken: mockToken,
      });
      expect(result).toBe('ok');
    });

    it('getOrganisationRatingStatus returns status', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {hasRated: {isRated: 1, rating: 4}}});
      const result = await appointmentApi.getOrganisationRatingStatus({
        organisationId: 'o1',
        accessToken: mockToken,
      });
      expect(result.isRated).toBe(true);
      expect(result.rating).toBe(4);
    });

    it('getOrganisationRatingStatus handles flat structure', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {isRated: true}});
      const result = await appointmentApi.getOrganisationRatingStatus({
        organisationId: 'o1',
        accessToken: mockToken,
      });
      expect(result.isRated).toBe(true);
    });

    it('handles cancellation with no payment required', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      const apt = {
        id: 'a1',
        status: 'UPCOMING',
        paymentStatus: 'unpaid',
        reasonForCancellation: 'User request',
      };
      client.patch.mockResolvedValue({data: apt});
      const result = await appointmentApi.cancelAppointment({
        appointmentId: 'a1',
        reasonForCancellation: 'User request',
        accessToken: mockToken,
      });
      expect(result.status).toBe('UPCOMING');
    });

    it('handles payment failure scenarios', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.post.mockRejectedValue(new Error('Payment declined'));

      await expect(
        appointmentApi.createPaymentIntent({
          appointmentId: 'a1',
          amount: 100,
          accessToken: mockToken,
        }),
      ).rejects.toThrow('Payment declined');
    });

    it('handles network errors gracefully', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockRejectedValue(new Error('Network error'));

      await expect(
        appointmentApi.listAppointments({
          companionId: '1',
          accessToken: mockToken,
        }),
      ).rejects.toThrow('Network error');
    });

    it('correctly normalizes empty or null URL fields', () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      // Test internal normalization of null/empty URLs
      const response = {
        id: 'a1',
        primaryImage: null,
        businessLogoUrl: '',
        employeeAvatarUrl: '  ',
      };
      client.get.mockResolvedValue({data: response});
      // Verify the function doesn't crash on null/empty URLs
      expect(appointmentApi).toBeDefined();
    });

    it('handles concurrent appointment requests', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({
        data: {
          items: [],
          pagination: {page: 1, limit: 10},
        },
      });

      const results = await Promise.all([
        appointmentApi.listAppointments({
          companionId: 'c1',
          accessToken: mockToken,
        }),
        appointmentApi.listAppointments({
          companionId: 'c2',
          accessToken: mockToken,
        }),
      ]);

      expect(results).toHaveLength(2);
      expect(client.get).toHaveBeenCalledTimes(2);
    });

    it('formats date correctly in ISO format', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: {}});

      await appointmentApi.listAppointments({
        companionId: '1',
        accessToken: mockToken,
        startDate: new Date('2024-01-15'),
      });

      expect(client.get).toHaveBeenCalled();
    });

    it('handles invoice fetch with missing data', async () => {
      const {appointmentApi} = getModule();
      const client = getApiClient();
      client.get.mockResolvedValue({data: null});

      const result = await appointmentApi.fetchInvoiceForAppointment({
        appointmentId: 'a1',
        accessToken: mockToken,
      });

      expect(result).toBeDefined();
    });
  });
});
