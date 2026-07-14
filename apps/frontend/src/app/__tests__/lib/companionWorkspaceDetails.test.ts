import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';

const fallback = { id: 'PT-1', name: 'Gigi', species: 'dog', breed: 'Golden Retriever' };

const baseCompanion = (overrides: Partial<StoredCompanion> = {}): StoredCompanion =>
  ({
    id: 'PT-48291',
    organisationId: 'org-1',
    parentId: 'parent-1',
    name: 'Gigi Hadid',
    type: 'dog',
    breed: 'Golden Retriever',
    dateOfBirth: new Date('2021-03-12T00:00:00Z'),
    gender: 'female',
    isInsured: false,
    ...overrides,
  }) as StoredCompanion;

const valueFor = (label: string, companion?: StoredCompanion) =>
  buildCompanionDetails(fallback, companion).find((row) => row.label === label)?.value;

describe('buildCompanionDetails', () => {
  it('falls back to the appointment summary before the companion record loads', () => {
    expect(valueFor('Name')).toBe('Gigi');
    expect(valueFor('Patient ID')).toBe('PT-1');
    expect(valueFor('Breed/Species')).toBe('Golden Retriever / Canine');
    // Unknown fields show a dash until the full record resolves.
    expect(valueFor('Age / DOB')).toBe('-');
    expect(valueFor('Blood Group')).toBe('-');
  });

  it('applies a caller-provided terminology rewrite to configurable labels', () => {
    const details = buildCompanionDetails(fallback, undefined, (text) =>
      text.replace('Patient', 'Pet')
    );
    expect(details.find((row) => row.label === 'Pet ID')?.value).toBe('PT-1');
  });

  it('maps a loaded companion record into all rows', () => {
    const companion = baseCompanion({
      isneutered: true,
      currentWeight: 55,
      bloodGroup: 'DEA 1.1',
      microchipNumber: 'ID-123457GHH',
      allergy: 'Sensitive skin',
    });
    expect(valueFor('Name', companion)).toBe('Gigi Hadid');
    expect(valueFor('Patient ID', companion)).toBe('PT-48291');
    expect(valueFor('Breed/Species', companion)).toBe('Golden Retriever / Canine');
    expect(valueFor('Age / DOB', companion)).toMatch(/years \/ /);
    expect(valueFor('Sex', companion)).toBe('Female, Spayed');
    expect(valueFor('Weight', companion)).toBe('55 kg');
    expect(valueFor('Blood Group', companion)).toBe('DEA 1.1');
    expect(valueFor('Microchip ID', companion)).toBe('ID-123457GHH');
    expect(valueFor('Allergies', companion)).toBe('Sensitive skin');
  });

  it('shows the neuter term by gender and omits it when unknown', () => {
    expect(valueFor('Sex', baseCompanion({ gender: 'male', isneutered: true }))).toBe(
      'Male, Neutered'
    );
    expect(valueFor('Sex', baseCompanion({ gender: 'male', isneutered: undefined }))).toBe('Male');
    expect(valueFor('Sex', baseCompanion({ gender: 'female', isneutered: false }))).toBe('Female');
  });

  it('handles a missing date of birth and weight gracefully', () => {
    const companion = baseCompanion({
      dateOfBirth: undefined as unknown as Date,
      currentWeight: undefined,
    });
    expect(valueFor('Age / DOB', companion)).toBe('-');
    expect(valueFor('Weight', companion)).toBe('-');
  });
});
