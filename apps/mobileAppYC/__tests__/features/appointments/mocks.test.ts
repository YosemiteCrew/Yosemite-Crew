jest.mock('@/assets/images', () => ({
  Images: {
    hospitalIcon: 'hospital-icon',
    groomingIcon: 'grooming-icon',
    documentIcon: 'document-icon',
  },
}));

import {
  mockServices,
  mockAvailability,
  mockAppointments,
  mockInvoices,
} from '@/features/appointments/mocks';

describe('features/appointments/mocks', () => {
  it('exports a non-empty list of vet services with required fields', () => {
    expect(mockServices.length).toBeGreaterThan(0);
    mockServices.forEach(service => {
      expect(service.id).toBeTruthy();
      expect(service.businessId).toBeTruthy();
      expect(service.name).toBeTruthy();
      expect(typeof service.basePrice).toBe('number');
    });
  });

  it('exports employee availability keyed by today for each entry', () => {
    const todayISO = new Date().toISOString().slice(0, 10);

    expect(mockAvailability.length).toBeGreaterThan(0);
    mockAvailability.forEach(entry => {
      expect(entry.slotsByDate[todayISO]).toBeDefined();
      expect(entry.slotsByDate[todayISO].length).toBeGreaterThan(0);
      entry.slotsByDate[todayISO].forEach(slot => {
        expect(slot.isAvailable).toBe(true);
        expect(slot.startTime).toBeTruthy();
      });
    });
  });

  it('mockAppointments returns an empty array regardless of companionId', () => {
    expect(mockAppointments('any-companion-id')).toEqual([]);
    expect(mockAppointments('')).toEqual([]);
  });

  it('exports a mock invoice with a computed total', () => {
    expect(mockInvoices.length).toBeGreaterThan(0);
    const invoice = mockInvoices[0];
    expect(invoice.subtotal).toBe(100);
    expect(invoice.total).toBe(115);
    expect(invoice.items.length).toBeGreaterThan(0);
  });
});
