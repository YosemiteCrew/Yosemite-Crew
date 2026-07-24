import { getOrganizationStatusStyle } from '@/app/ui/tables/tableUtils';

describe('getOrganizationStatusStyle', () => {
  it("returns the success style for 'Active' (case insensitive)", () => {
    const expected = {
      color: 'var(--color-success-400)',
      backgroundColor: 'var(--color-success-100)',
    };
    expect(getOrganizationStatusStyle('Active')).toEqual(expected);
    expect(getOrganizationStatusStyle('active')).toEqual(expected);
  });

  it("returns the warning style for 'Pending'", () => {
    expect(getOrganizationStatusStyle('Pending')).toEqual({
      color: 'var(--color-warning-600)',
      backgroundColor: 'var(--color-warning-100)',
    });
  });

  it('returns the default style for an unknown status', () => {
    expect(getOrganizationStatusStyle('Unknown')).toEqual({
      color: 'var(--color-neutral-0)',
      backgroundColor: 'var(--color-badge-blue-bg)',
    });
  });
});
