import {
  conditionLabel,
  describeTooth,
  getDentalQuadrants,
  hasFinding,
  isTriadanTooth,
  resolveDentalSpecies,
} from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/dentalChart';

const teeth = (species: string | undefined, dentition: 'PERMANENT' | 'DECIDUOUS') =>
  getDentalQuadrants(species, dentition).flatMap((quadrant) => quadrant.teeth);

describe('getDentalQuadrants', () => {
  it('charts the 42 canine and 30 feline permanent teeth with the species gaps', () => {
    const dog = teeth('Dog', 'PERMANENT');
    const cat = teeth('Felis catus', 'PERMANENT');

    expect(dog).toHaveLength(42);
    expect(dog.slice(0, 10)).toEqual([
      '101',
      '102',
      '103',
      '104',
      '105',
      '106',
      '107',
      '108',
      '109',
      '110',
    ]);
    expect(dog).toContain('311');
    expect(dog).not.toContain('111');
    expect(cat).toHaveLength(30);
    expect(cat).toEqual(expect.arrayContaining(['106', '109', '307', '409']));
    for (const absent of ['105', '205', '305', '306', '406', '110', '310']) {
      expect(cat).not.toContain(absent);
    }
  });

  it('charts the 28 canine and 26 feline deciduous teeth in quadrants 5 to 8', () => {
    const dog = teeth('canine', 'DECIDUOUS');
    const cat = teeth('cat', 'DECIDUOUS');

    expect(dog).toHaveLength(28);
    expect(dog).toContain('706');
    expect(cat).toHaveLength(26);
    expect(cat).not.toContain('706');
    expect(cat).toContain('606');
    expect(new Set([...dog, ...cat].map((tooth) => tooth[0]))).toEqual(
      new Set(['5', '6', '7', '8'])
    );
  });

  it('labels quadrants clockwise from the right maxilla', () => {
    expect(getDentalQuadrants('dog', 'DECIDUOUS').map((q) => [q.id, q.label])).toEqual([
      ['5', 'Right maxillary'],
      ['6', 'Left maxillary'],
      ['7', 'Left mandibular'],
      ['8', 'Right mandibular'],
    ]);
  });

  it('has no chart for other or unknown species', () => {
    expect(getDentalQuadrants('horse', 'PERMANENT')).toEqual([]);
    expect(getDentalQuadrants(undefined, 'PERMANENT')).toEqual([]);
  });
});

describe('resolveDentalSpecies', () => {
  it.each([
    ['Dog', 'dog'],
    ['  Canis lupus familiaris  ', 'dog'],
    ['Canine', 'dog'],
    ['dogs', 'dog'],
    ['Cat', 'cat'],
    ['Felis catus', 'cat'],
    ['feline', 'cat'],
  ])('reads %s as %s', (species, expected) => {
    expect(resolveDentalSpecies(species)).toBe(expected);
  });

  it.each(['Cattle', 'Catfish', 'Dogfish', 'Hotdog', 'Bobcat', '', 'horse'])(
    'does not chart %s as a dog or cat',
    (species) => {
      expect(resolveDentalSpecies(species)).toBeUndefined();
    }
  );
});

describe('isTriadanTooth', () => {
  it.each(['101', '111', '411', '501', '808'])('accepts %s', (tooth) => {
    expect(isTriadanTooth(tooth)).toBe(true);
  });

  it.each(['001', '901', '100', '112', '1011', '10', 'abc'])('rejects %s', (tooth) => {
    expect(isTriadanTooth(tooth)).toBe(false);
  });
});

describe('describeTooth', () => {
  it.each([
    ['101', 'right maxillary first incisor'],
    ['203', 'left maxillary third incisor'],
    ['104', 'right maxillary canine'],
    ['105', 'right maxillary first premolar'],
    ['208', 'left maxillary fourth premolar'],
    ['309', 'left mandibular first molar'],
    ['411', 'right mandibular third molar'],
    ['604', 'left maxillary deciduous canine'],
    ['808', 'right mandibular deciduous fourth premolar'],
  ])('names %s as the %s', (tooth, name) => {
    expect(describeTooth(tooth)).toBe(name);
  });

  it('returns no name for a number outside the system', () => {
    expect(describeTooth('999')).toBe('');
  });
});

describe('finding helpers', () => {
  it('reads a condition as plain words', () => {
    expect(conditionLabel('TOOTH_RESORPTION')).toBe('Tooth resorption');
    expect(conditionLabel(undefined)).toBe('Finding recorded');
  });

  it('treats a tooth with only blank notes as not charted', () => {
    expect(hasFinding({ tooth: '104', notes: '  ' })).toBe(false);
    expect(hasFinding({ tooth: '104', calculus: 0 })).toBe(true);
    expect(hasFinding(undefined)).toBe(false);
  });
});
