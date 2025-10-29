import {deriveHomeGreetingName} from '@/features/home/screens/HomeScreen/HomeScreen';

describe('deriveHomeGreetingName', () => {
  it('falls back to Sky when name is empty', () => {
    expect(deriveHomeGreetingName('')).toEqual({
      resolvedName: 'Sky',
      displayName: 'Sky',
    });
    expect(deriveHomeGreetingName('   ')).toEqual({
      resolvedName: 'Sky',
      displayName: 'Sky',
    });
    expect(deriveHomeGreetingName(undefined)).toEqual({
      resolvedName: 'Sky',
      displayName: 'Sky',
    });
  });

  it('returns trimmed name when present', () => {
    expect(deriveHomeGreetingName('  Luna ')).toEqual({
      resolvedName: 'Luna',
      displayName: 'Luna',
    });
  });

  it('truncates long names to 13 characters with ellipsis', () => {
    const result = deriveHomeGreetingName('Supercalifragilistic');
    expect(result.resolvedName).toBe('Supercalifragilistic');
    expect(result.displayName).toBe('Supercalifrag...');
    expect(result.displayName.length).toBeLessThanOrEqual(16);
  });
});
