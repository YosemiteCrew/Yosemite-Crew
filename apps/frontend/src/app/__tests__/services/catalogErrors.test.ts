import {
  getCatalogErrorCode,
  getCatalogErrorMessage,
  getCatalogDependencySummary,
} from '@/app/features/organization/services/catalogErrors';

const dependencyError = {
  response: {
    data: {
      error: {
        code: 'CATALOG_ITEM_HAS_DEPENDENCIES',
        message: 'Catalog item cannot be permanently deleted because it has dependencies.',
        details: { packageDependencies: 1, appointments: 0, invoices: 0 },
      },
    },
  },
};

describe('catalogErrors', () => {
  describe('getCatalogErrorMessage', () => {
    it('prefers the nested error.message', () => {
      expect(getCatalogErrorMessage(dependencyError, 'fallback')).toBe(
        'Catalog item cannot be permanently deleted because it has dependencies.'
      );
    });

    it('falls back to the top-level message', () => {
      const error = { response: { data: { message: 'Package not found.' } } };
      expect(getCatalogErrorMessage(error, 'fallback')).toBe('Package not found.');
    });

    it('uses the fallback when no message is present', () => {
      expect(getCatalogErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback');
      expect(getCatalogErrorMessage(undefined, 'fallback')).toBe('fallback');
      expect(getCatalogErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    });

    it('ignores blank messages', () => {
      const error = { response: { data: { error: { message: '   ' } } } };
      expect(getCatalogErrorMessage(error, 'fallback')).toBe('fallback');
    });
  });

  describe('getCatalogErrorCode', () => {
    it('returns the error code when present', () => {
      expect(getCatalogErrorCode(dependencyError)).toBe('CATALOG_ITEM_HAS_DEPENDENCIES');
    });

    it('returns undefined when absent', () => {
      expect(getCatalogErrorCode({ response: { data: {} } })).toBeUndefined();
      expect(getCatalogErrorCode('nope')).toBeUndefined();
    });
  });

  describe('getCatalogDependencySummary', () => {
    it('summarises non-zero dependency counts with singular/plural labels', () => {
      expect(getCatalogDependencySummary(dependencyError)).toBe('1 package');
    });

    it('joins multiple dependencies', () => {
      const error = {
        response: {
          data: {
            error: {
              details: { packageDependencies: 2, appointments: 1 },
            },
          },
        },
      };
      expect(getCatalogDependencySummary(error)).toBe('2 packages, 1 appointment');
    });

    it('returns undefined when there are no dependencies', () => {
      expect(getCatalogDependencySummary({ response: { data: { error: {} } } })).toBeUndefined();
      expect(getCatalogDependencySummary({ response: { data: {} } })).toBeUndefined();
    });
  });
});
