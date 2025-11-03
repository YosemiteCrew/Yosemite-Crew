import {deriveHomeGreetingName} from '@/features/home/screens/HomeScreen/HomeScreen';

describe('deriveHomeGreetingName', () => {
  it('uses trimmed name when provided', () => {
    const r = deriveHomeGreetingName('  Sky  ');
    expect(r.resolvedName).toBe('Sky');
    expect(r.displayName).toBe('Sky');
  });

  it('falls back to Sky when blank', () => {
    const r1 = deriveHomeGreetingName('   ');
    const r2 = deriveHomeGreetingName(undefined);
    expect(r1.resolvedName).toBe('Sky');
    expect(r2.resolvedName).toBe('Sky');
  });

  it('truncates very long names to 13 chars + ellipsis', () => {
    const long = 'Supercalifragilisticexpialidocious';
    const r = deriveHomeGreetingName(long);
    expect(r.displayName.length).toBe(16); // 13 + '...'
    expect(r.displayName.endsWith('...')).toBe(true);
  });
});

