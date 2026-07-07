import {
  uniq,
  computeEffectivePermissions,
} from '@/app/features/organization/pages/Organization/Sections/Team/permissionsEditorUtils';

describe('permissionsEditorUtils', () => {
  describe('uniq', () => {
    it('removes duplicates while preserving first-seen order', () => {
      expect(uniq(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for empty input', () => {
      expect(uniq([])).toEqual([]);
    });
  });

  describe('computeEffectivePermissions', () => {
    it('returns role defaults when no extra/revoked provided', () => {
      const result = computeEffectivePermissions({ role: 'RECEPTIONIST' });
      expect(result).toContain('appointments:view:any');
      expect(result.length).toBeGreaterThan(0);
    });

    it('adds extra permissions not already granted by the role', () => {
      const result = computeEffectivePermissions({
        role: 'RECEPTIONIST',
        extraPerissions: ['org:delete'],
      });
      expect(result).toContain('org:delete');
    });

    it('removes revoked permissions from the effective set', () => {
      const result = computeEffectivePermissions({
        role: 'RECEPTIONIST',
        revokedPermissions: ['appointments:view:any'],
      });
      expect(result).not.toContain('appointments:view:any');
    });

    it('revoked permissions take precedence over extra permissions', () => {
      const result = computeEffectivePermissions({
        role: 'RECEPTIONIST',
        extraPerissions: ['org:delete'],
        revokedPermissions: ['org:delete'],
      });
      expect(result).not.toContain('org:delete');
    });

    it('does not duplicate a permission already in role defaults when also passed as extra', () => {
      const result = computeEffectivePermissions({
        role: 'RECEPTIONIST',
        extraPerissions: ['appointments:view:any'],
      });
      const occurrences = result.filter((p) => p === 'appointments:view:any').length;
      expect(occurrences).toBe(1);
    });
  });
});
