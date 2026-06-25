import { buildStaffCard } from '@/app/features/companionCard/lib/buildStaffCard';
import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';

jest.mock('@/app/features/appointments/lib/alertMapping', () => ({
  storedAlertsToCompanionAlerts: jest.fn(() => [
    { id: 'a1', label: 'Needs muzzle', severity: 'high' },
    { id: 'a2', label: 'Diabetic', severity: 'critical' },
  ]),
}));

const { storedAlertsToCompanionAlerts } = jest.requireMock(
  '@/app/features/appointments/lib/alertMapping'
);

const record = {
  companion: {
    id: 'pat-1',
    name: 'Doggy',
    type: 'dog',
    breed: 'Rottweiler',
    colour: 'black',
    photoUrl: 'http://img/doggy.png',
    microchipNumber: '1234',
    passportNumber: '5678',
    dateOfBirth: new Date('2024-01-10T00:00:00.000Z'),
    currentWeight: 15,
    allergy: 'pollen',
    bloodGroup: 'DEA 1.1 Positive',
    isneutered: true,
    isInsured: true,
    insurance: { companyName: 'PetCo', policyNumber: 'SECRET' },
    alerts: [{ title: 'x' }],
  },
  parent: {
    firstName: 'Harshit',
    lastName: 'Wandhare',
    phoneNumber: '+919307633967',
    email: 'harshit@example.com',
  },
} as unknown as CompanionParent;

describe('buildStaffCard', () => {
  it('maps a companion record to a full STAFF card', () => {
    const card = buildStaffCard(record);
    expect(card.audience).toBe('STAFF');
    expect(card.identity).toEqual({
      id: 'pat-1',
      name: 'Doggy',
      type: 'dog',
      breed: 'Rottweiler',
      colour: 'black',
      photoUrl: 'http://img/doggy.png',
      microchipNumber: '1234',
    });
    expect(card.passportNumber).toBe('5678');
    expect(card.dateOfBirth).toBe('2024-01-10T00:00:00.000Z');
    expect(card.alerts).toEqual([
      { title: 'Needs muzzle', severity: 'high' },
      { title: 'Diabetic', severity: 'critical' },
    ]);
    expect(card.medical).toEqual({
      allergy: 'pollen',
      bloodGroup: 'DEA 1.1 Positive',
      currentWeight: 15,
      isNeutered: true,
    });
    expect(card.insurance).toEqual({ isInsured: true, companyName: 'PetCo' });
    expect(card.insurance).not.toHaveProperty('policyNumber');
    expect(card.ownerContact).toEqual({
      firstName: 'Harshit',
      lastName: 'Wandhare',
      phoneNumber: '+919307633967',
      email: 'harshit@example.com',
    });
  });

  it('handles missing optional data', () => {
    (storedAlertsToCompanionAlerts as jest.Mock).mockReturnValueOnce([]);
    const minimal = {
      companion: {
        id: 'p2',
        name: 'Min',
        type: 'cat',
        breed: 'DSH',
        isInsured: false,
        insurance: null,
        dateOfBirth: null,
        alerts: null,
      },
      parent: { firstName: 'Sam', lastName: null, phoneNumber: null, email: 'sam@example.com' },
    } as unknown as CompanionParent;
    const card = buildStaffCard(minimal);
    expect(card.alerts).toBeUndefined();
    expect(card.dateOfBirth).toBeUndefined();
    expect(card.insurance).toEqual({ isInsured: false, companyName: undefined });
    expect(card.ownerContact).toEqual({
      firstName: 'Sam',
      lastName: undefined,
      phoneNumber: undefined,
      email: 'sam@example.com',
    });
  });

  it('parses a string date of birth', () => {
    const r = {
      ...record,
      companion: { ...record.companion, dateOfBirth: '2020-05-05T00:00:00.000Z' },
    } as unknown as CompanionParent;
    expect(buildStaffCard(r).dateOfBirth).toBe('2020-05-05T00:00:00.000Z');
  });

  it('ignores an invalid date of birth', () => {
    const r = {
      ...record,
      companion: { ...record.companion, dateOfBirth: 'not-a-date' },
    } as unknown as CompanionParent;
    expect(buildStaffCard(r).dateOfBirth).toBeUndefined();
  });

  it('treats a non-string insurance company as undefined', () => {
    const r = {
      ...record,
      companion: { ...record.companion, insurance: { companyName: 123 } },
    } as unknown as CompanionParent;
    expect(buildStaffCard(r).insurance).toEqual({ isInsured: true, companyName: undefined });
  });
});
