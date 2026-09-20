import {deriveHomeGreetingName} from '@/features/home/screens/HomeScreen/HomeScreen.helpers';

describe('deriveHomeGreetingName', () => {
  it('greets neutrally when the name is empty', () => {
    expect(deriveHomeGreetingName('')).toEqual({
      resolvedName: 'there',
      displayName: 'there',
    });
    expect(deriveHomeGreetingName('   ')).toEqual({
      resolvedName: 'there',
      displayName: 'there',
    });
    expect(deriveHomeGreetingName(undefined)).toEqual({
      resolvedName: 'there',
      displayName: 'there',
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
