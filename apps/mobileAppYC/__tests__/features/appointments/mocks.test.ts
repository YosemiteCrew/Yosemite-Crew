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
  todayISO,
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

  it('todayISO returns the device-local calendar day, not the UTC day', () => {
    // Pins the local-date semantics the fixture and the consuming screens rely on.
    // Deriving the key with `toISOString().slice(0, 10)` would give the UTC day,
    // which differs from the local day between midnight and the UTC offset.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-24T22:30:00Z'));
    try {
      const d = new Date();
      const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(d.getDate()).padStart(2, '0')}`;

      expect(todayISO()).toBe(expected);
    } finally {
      jest.useRealTimers();
    }
  });

  it('exports employee availability keyed by today for each entry', () => {
    // Reuse the fixture's own helper - deriving this key independently is how this
    // test used to drift from the fixture in any timezone ahead of UTC.
    const today = todayISO();

    expect(mockAvailability.length).toBeGreaterThan(0);
    mockAvailability.forEach(entry => {
      expect(entry.slotsByDate[today]).toBeDefined();
      expect(entry.slotsByDate[today].length).toBeGreaterThan(0);
      entry.slotsByDate[today].forEach(slot => {
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
