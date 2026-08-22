import {
  hasSignatureField,
  deriveFormStatus,
  normalizeSubmissionFromApi,
  resolveFormVersion,
  normalizeFormForState,
  stripHtmlToPlainText,
  wrapPlainTextAsHtml,
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

      it('returns "signed" if status is COMPLETED', () => {
        const submission: any = {signing: {status: 'COMPLETED'}};
        expect(deriveFormStatus(submission, true)).toBe('signed');
      });

      it('returns "signed" when signed PDF url is available', () => {
        const submission: any = {
          signing: {
            status: 'IN_PROGRESS',
            pdf: {url: 'https://example.com/signed.pdf'},
          },
        };
        expect(deriveFormStatus(submission, true)).toBe('signed');
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

        const result = normalizeSubmissionFromApi(
          raw,
          undefined,
          fallback as any,
        );

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
          const result = normalizeSubmissionFromApi(
            {},
            undefined,
            fallback as any,
          );
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

  // =========================================================================
  // stripHtmlToPlainText / wrapPlainTextAsHtml
  // =========================================================================
  describe('stripHtmlToPlainText', () => {
    it('returns an empty string for null/undefined/empty input', () => {
      expect(stripHtmlToPlainText(undefined)).toBe('');
      expect(stripHtmlToPlainText(null)).toBe('');
      expect(stripHtmlToPlainText('')).toBe('');
    });

    it('strips paragraph and line-break tags into newlines', () => {
      expect(stripHtmlToPlainText('<p>Line one</p><p>Line two</p>')).toBe(
        'Line one\nLine two',
      );
      expect(stripHtmlToPlainText('Line one<br>Line two')).toBe(
        'Line one\nLine two',
      );
    });

    it('strips any other tags without adding newlines', () => {
      expect(stripHtmlToPlainText('<strong>Bold</strong> text')).toBe(
        'Bold text',
      );
    });

    it('decodes common HTML entities', () => {
      expect(
        stripHtmlToPlainText('Tom &amp; Jerry &lt;3&gt; &quot;ok&quot;'),
      ).toBe('Tom & Jerry <3> "ok"');
      expect(stripHtmlToPlainText('a&nbsp;b&#39;s')).toBe("a b's");
    });

    it('collapses excess blank lines and trims surrounding whitespace', () => {
      expect(stripHtmlToPlainText('<p></p><p></p><p>Text</p>')).toBe('Text');
    });

    it('fully strips nested/malformed tags that would reconstitute after a single pass', () => {
      // A naive single-pass replace removes the inner "<script>", which
      // reconstitutes "<scr" + "ipt>" into a fresh <script> tag left behind.
      expect(
        stripHtmlToPlainText('<scr<script>ipt>alert(1)</scr<script>ipt>'),
      ).toBe('alert(1)');
    });
  });

  describe('wrapPlainTextAsHtml', () => {
    it('wraps a single line in a paragraph tag', () => {
      expect(wrapPlainTextAsHtml('Hello world')).toBe('<p>Hello world</p>');
    });

    it('wraps each newline-separated line in its own paragraph tag', () => {
      expect(wrapPlainTextAsHtml('Line one\nLine two')).toBe(
        '<p>Line one</p><p>Line two</p>',
      );
    });

    it('escapes HTML special characters so user text cannot inject markup', () => {
      expect(wrapPlainTextAsHtml('<script>&"</script>')).toBe(
        '<p>&lt;script&gt;&amp;"&lt;/script&gt;</p>',
      );
    });

    it('returns an empty string instead of "<p></p>" when the text has no real content', () => {
      expect(wrapPlainTextAsHtml('')).toBe('');
      expect(wrapPlainTextAsHtml('   ')).toBe('');
      expect(wrapPlainTextAsHtml('\n\n\n')).toBe('');
      expect(wrapPlainTextAsHtml('  \n  \n  ')).toBe('');
    });
  });
});

describe('stripHtmlToPlainText input bounds', () => {
  it('finishes promptly on adversarial nested brackets', () => {
    // "<<<<...>>>>" removes one innermost pair per pass, so the unbounded loop
    // was quadratic: a ~50k answer took seconds, which on a phone's JS thread
    // is a frozen app. Rich-text answers come from appointment form data.
    const hostile = '<'.repeat(25_000) + '>'.repeat(25_000);

    const startedAt = process.hrtime.bigint();
    const result = stripHtmlToPlainText(hostile);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    expect(elapsedMs).toBeLessThan(1_000);
    // Fails closed: nothing tag-shaped survives.
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('still strips ordinary nested markup exactly', () => {
    expect(stripHtmlToPlainText('<p>Hello <b>world</b></p>')).toBe(
      'Hello world',
    );
    // The reconstituting case the fixed-point loop exists for.
    expect(stripHtmlToPlainText('<scr<script>ipt>alert(1)')).toBe('alert(1)');
  });
});
