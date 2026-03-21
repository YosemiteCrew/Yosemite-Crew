import {
  hasSignatureField,
  deriveFormStatus,
  normalizeSubmissionFromApi,
  resolveFormVersion,
  normalizeFormForState,
} from '../../../src/features/forms/utils';
import {fromFormSubmissionRequestDTO} from '@yosemite-crew/types';

// Mock external dependencies
jest.mock('@yosemite-crew/types', () => ({
  fromFormSubmissionRequestDTO: jest.fn(),
}));

describe('Form Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix system time for consistent Date testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // 1. hasSignatureField
  // =========================================================================
  describe('hasSignatureField', () => {
    it('returns false for undefined or empty fields', () => {
      expect(hasSignatureField(undefined)).toBe(false);
      expect(hasSignatureField([])).toBe(false);
    });

    it('returns true if a top-level signature field exists', () => {
      const fields: any[] = [
        {type: 'text', id: '1'},
        {type: 'signature', id: '2'},
      ];
      expect(hasSignatureField(fields)).toBe(true);
    });

    it('returns true if a nested signature field exists (recursive)', () => {
      const fields: any[] = [
        {type: 'text', id: '1'},
        {
          type: 'group',
          id: 'g1',
          fields: [
            {type: 'text', id: 'g1-1'},
            {type: 'signature', id: 'g1-sig'},
          ],
        },
      ];
      expect(hasSignatureField(fields)).toBe(true);
    });

    it('returns false if no signature field exists in nested structure', () => {
      const fields: any[] = [
        {type: 'text', id: '1'},
        {
          type: 'group',
          id: 'g1',
          fields: [{type: 'text', id: 'g1-1'}],
        },
      ];
      expect(hasSignatureField(fields)).toBe(false);
    });
  });

  // =========================================================================
  // 2. deriveFormStatus
  // =========================================================================
  describe('deriveFormStatus', () => {
    it('returns "not_started" if submission is null/undefined', () => {
      expect(deriveFormStatus(null, false)).toBe('not_started');
      expect(deriveFormStatus(undefined, true)).toBe('not_started');
    });

    it('returns "completed" if signing is NOT required (regardless of signing status)', () => {
      const submission: any = {signing: {status: 'NOT_STARTED'}};
      expect(deriveFormStatus(submission, false)).toBe('completed');
    });

    describe('when signing is required', () => {
      it('returns "signed" if signing status is SIGNED', () => {
        const submission: any = {signing: {status: 'SIGNED'}};
        expect(deriveFormStatus(submission, true)).toBe('signed');
      });

      it('returns "signing" if status is IN_PROGRESS', () => {
        const submission: any = {signing: {status: 'IN_PROGRESS'}};
        expect(deriveFormStatus(submission, true)).toBe('signing');
      });

      it('returns "signing" if status is NOT_STARTED', () => {
        const submission: any = {signing: {status: 'NOT_STARTED'}};
        expect(deriveFormStatus(submission, true)).toBe('signing');
      });

      it('returns "submitted" for any other status (e.g. pending server processing)', () => {
        const submission: any = {signing: {status: 'UNKNOWN'}};
        expect(deriveFormStatus(submission, true)).toBe('submitted');
      });

      it('returns "submitted" if signing object is missing but required', () => {
        const submission: any = {};
        expect(deriveFormStatus(submission, true)).toBe('submitted');
      });
    });
  });

  // =========================================================================
  // 3. normalizeSubmissionFromApi
  // =========================================================================
  describe('normalizeSubmissionFromApi', () => {
    describe('QuestionnaireResponse (DTO)', () => {
      it('parses using fromFormSubmissionRequestDTO and coerces dates', () => {
        const raw = {resourceType: 'QuestionnaireResponse'};
        const mockParsed = {
          _id: 'sub-1',
          submittedAt: '2025-02-01T10:00:00Z',
        };
        (fromFormSubmissionRequestDTO as jest.Mock).mockReturnValue(mockParsed);

        const result = normalizeSubmissionFromApi(raw);

        expect(fromFormSubmissionRequestDTO).toHaveBeenCalledWith(
          raw,
          undefined,
        );
        expect(result).toEqual({
          ...mockParsed,
          submittedAt: '2025-02-01T10:00:00.000Z',
        });
      });

      it('defaults to current time if submittedAt in DTO is missing/invalid', () => {
        const raw = {resourceType: 'QuestionnaireResponse'};
        (fromFormSubmissionRequestDTO as jest.Mock).mockReturnValue({
          _id: 'sub-1',
          submittedAt: null,
        });

        const result = normalizeSubmissionFromApi(raw);
        // Should be mocked system time
        expect(result.submittedAt).toBe('2025-01-01T12:00:00.000Z');
      });
    });

    describe('Standard Object Normalization', () => {
      it('normalizes basic fields and falls back to provided fallbacks', () => {
        const raw = {
          _id: '123',
          formId: 'form-1',
          answers: {q1: 'a1'},
        };
        const fallback = {
          appointmentId: 'appt-1',
        };

        const result = normalizeSubmissionFromApi(raw, undefined, fallback as any);

        expect(result._id).toBe('123');
        expect(result.formId).toBe('form-1');
        expect(result.appointmentId).toBe('appt-1');
        expect(result.formVersion).toBe(1); // Default
        expect(result.submittedAt).toBe('2025-01-01T12:00:00.000Z'); // Default coerced date
      });

      it('normalizes form IDs correctly (internal helper coverage)', () => {
        const raw = {
          _id: {_id: 'mongo-id'}, // Object with _id
          formId: {id: 'sql-id'}, // Object with id
          appointmentId: {
            toString: () => 'string-id', // Object with toString
          },
        };

        const result = normalizeSubmissionFromApi(raw);

        expect(result._id).toBe('mongo-id');
        expect(result.formId).toBe('sql-id');
        // appointmentId isn't run through normalizeFormId in the function body explicitly,
        // it's assigned directly, but let's check explicit ID fields.
      });

      it('handles null/undefined inputs for ID normalization', () => {
        const result = normalizeSubmissionFromApi({});
        expect(result._id).toBe('');
        expect(result.formId).toBe('');
      });

      it('sanitizes answers correctly (internal helper coverage)', () => {
        const dateVal = new Date('2023-01-01');
        const raw = {
          answers: {
            dateField: dateVal,
            arrayField: ['a', dateVal],
            urlField: {url: 'http://example.com'},
            emptyObj: {},
            complexObj: {key: 'val'},
            nullField: null,
          },
        };

        const result = normalizeSubmissionFromApi(raw);
        const ans = result.answers;

        expect(ans.dateField).toBe(dateVal.toISOString());
        expect(ans.arrayField).toEqual(['a', dateVal.toISOString()]);
        expect(ans.urlField).toBe('http://example.com');
        expect(ans.emptyObj).toBe('');
        expect(ans.complexObj).toBe('{"key":"val"}');
      });

      it('handles missing answers or non-object answers', () => {
        const result = normalizeSubmissionFromApi({answers: 'invalid'});
        expect(result.answers).toEqual({});
      });

      describe('Date Coercion (internal helper coverage)', () => {
        it('coerces Date object in submittedAt', () => {
          const d = new Date('2020-01-01');
          const result = normalizeSubmissionFromApi({submittedAt: d});
          expect(result.submittedAt).toBe(d.toISOString());
        });

        it('coerces valid string in submittedAt', () => {
          const result = normalizeSubmissionFromApi({
            submittedAt: '2020-02-01T00:00:00Z',
          });
          expect(result.submittedAt).toBe('2020-02-01T00:00:00.000Z');
        });

        it('defaults to now for invalid date string', () => {
          const result = normalizeSubmissionFromApi({
            submittedAt: 'invalid-date',
          });
          expect(result.submittedAt).toBe('2025-01-01T12:00:00.000Z');
        });
      });

      describe('Signing Object Normalization', () => {
        it('passes through signing object if present', () => {
          const raw = {
            signing: {status: 'SIGNED'},
          };
          const result = normalizeSubmissionFromApi(raw);
          expect(result.signing?.status).toBe('SIGNED');
        });

        it('coerces signedAt inside signing object if present', () => {
          const raw = {
            signing: {
              status: 'SIGNED',
              signedAt: '2020-05-05T12:00:00Z',
            },
          };
          const result = normalizeSubmissionFromApi(raw);
          expect(result.signing?.signedAt).toBe('2020-05-05T12:00:00.000Z');
        });

        it('uses fallback signing if raw missing', () => {
          const fallback = {
            signing: {status: 'IN_PROGRESS'},
          };
          const result = normalizeSubmissionFromApi({}, undefined, fallback as any);
          expect(result.signing?.status).toBe('IN_PROGRESS');
        });
      });
    });
  });

  // =========================================================================
  // 4. resolveFormVersion
  // =========================================================================
  describe('resolveFormVersion', () => {
    it('returns submission version if available', () => {
      const form: any = {formVersion: 1};
      const submission: any = {formVersion: 5};
      expect(resolveFormVersion(form, submission)).toBe(5);
    });

    it('returns form version if submission is null/undefined', () => {
      const form: any = {formVersion: 2};
      expect(resolveFormVersion(form, null)).toBe(2);
      expect(resolveFormVersion(form, undefined)).toBe(2);
    });

    it('defaults to 1 if neither has version', () => {
      const form: any = {};
      expect(resolveFormVersion(form, null)).toBe(1);
    });
  });

  // =========================================================================
  // 5. normalizeFormForState
  // =========================================================================
  describe('normalizeFormForState', () => {
    it('converts Date objects to ISO strings for createdAt/updatedAt', () => {
      const form: any = {
        createdAt: new Date('2021-01-01'),
        updatedAt: new Date('2021-01-02'),
      };
      const result = normalizeFormForState(form);
      expect(result.createdAt).toBe('2021-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2021-01-02T00:00:00.000Z');
    });

    it('converts valid strings to ISO strings', () => {
      const form: any = {
        createdAt: '2021-01-01T10:00:00Z',
      };
      const result = normalizeFormForState(form);
      expect(result.createdAt).toBe('2021-01-01T10:00:00.000Z');
    });

    it('returns undefined for invalid date strings (safeDate logic)', () => {
      const form: any = {
        createdAt: 'not-a-date',
      };
      const result = normalizeFormForState(form);
      expect(result.createdAt).toBeUndefined();
    });

    it('returns undefined for null/missing values', () => {
      const form: any = {
        createdAt: null,
      };
      const result = normalizeFormForState(form);
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });
  });
});