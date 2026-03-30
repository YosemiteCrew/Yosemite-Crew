import { allowDelete } from '@/app/lib/team';

describe('allowDelete', () => {
  it('returns false for OWNER role', () => {
    expect(allowDelete('OWNER')).toBe(false);
  });

  it('returns true for ADMIN role', () => {
    expect(allowDelete('ADMIN')).toBe(true);
  });

  it('returns true for MEMBER role', () => {
    expect(allowDelete('MEMBER')).toBe(true);
  });

  it('returns true for VIEWER role', () => {
    expect(allowDelete('VIEWER')).toBe(true);
  });
});
