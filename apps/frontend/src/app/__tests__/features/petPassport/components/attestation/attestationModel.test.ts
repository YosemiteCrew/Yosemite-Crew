import {
  PASSPORT_RECORD_STATUS_META,
  canAttestStatus,
  getAttestationErrorMessage,
  getPassportRecordLink,
  getRecordOrigin,
  getReviewFields,
  isDocumensoUnavailable,
} from '@/app/features/petPassport/components/attestation/attestationModel';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

const baseRecord: CompanionRecord = {
  id: 'doc-1',
  title: 'Rabies certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
};

const axiosError = (status: number, message?: unknown, fallbackMessage = 'Request failed') => ({
  isAxiosError: true,
  message: fallbackMessage,
  response: { status, data: message === undefined ? {} : { message } },
});

const fieldValue = (record: CompanionRecord, label: string) =>
  getReviewFields(record).find((field) => field.label === label)?.value;

describe('getPassportRecordLink', () => {
  it('returns null when the API has not linked the document to a passport record', () => {
    expect(getPassportRecordLink(baseRecord)).toBeNull();
  });

  it('returns null for a blank link id', () => {
    expect(
      getPassportRecordLink({ ...baseRecord, passportRecordId: '   ' } as CompanionRecord)
    ).toBeNull();
  });

  it('returns the linked record id with its status', () => {
    expect(
      getPassportRecordLink({
        ...baseRecord,
        passportRecordId: 'artifact-1',
        passportRecordStatus: 'SIGNED',
      } as CompanionRecord)
    ).toEqual({ recordId: 'artifact-1', status: 'SIGNED' });
  });

  it('falls back to DRAFT when the status is absent or unrecognised', () => {
    expect(
      getPassportRecordLink({ ...baseRecord, passportRecordId: 'artifact-1' } as CompanionRecord)
    ).toEqual({ recordId: 'artifact-1', status: 'DRAFT' });

    expect(
      getPassportRecordLink({
        ...baseRecord,
        passportRecordId: 'artifact-1',
        passportRecordStatus: 'PENDING_SOMETHING',
      } as unknown as CompanionRecord)
    ).toEqual({ recordId: 'artifact-1', status: 'DRAFT' });
  });
});

describe('canAttestStatus', () => {
  it('allows a draft or pending record and blocks a signed or void one', () => {
    expect(canAttestStatus('DRAFT')).toBe(true);
    expect(canAttestStatus('IN_PROGRESS')).toBe(true);
    expect(canAttestStatus('SIGNED')).toBe(false);
    expect(canAttestStatus('VOID')).toBe(false);
  });
});

describe('PASSPORT_RECORD_STATUS_META', () => {
  it('never claims a pending signature is passport-valid', () => {
    const pending = PASSPORT_RECORD_STATUS_META.IN_PROGRESS;
    expect(pending.label).toBe('Signature pending');
    expect(pending.detail).toContain('not passport-valid yet');
    expect(PASSPORT_RECORD_STATUS_META.SIGNED.detail).toContain('carried in the pet passport');
    expect(PASSPORT_RECORD_STATUS_META.DRAFT.tone).toBe('neutral');
    expect(PASSPORT_RECORD_STATUS_META.VOID.tone).toBe('danger');
  });
});

describe('getAttestationErrorMessage', () => {
  it('surfaces the API message when the service explains itself', () => {
    expect(
      getAttestationErrorMessage(axiosError(409, 'Record is already attested.'), 'fallback')
    ).toBe('Record is already attested.');
  });

  it('falls back to the axios message when the body carries none', () => {
    expect(
      getAttestationErrorMessage(axiosError(500, undefined, 'Network Error'), 'fallback')
    ).toBe('Network Error');
  });

  it('ignores a non-string message body', () => {
    expect(
      getAttestationErrorMessage(axiosError(400, { nested: true }, 'Bad Request'), 'fallback')
    ).toBe('Bad Request');
  });

  it('uses the caller fallback for a non-axios failure and for an empty message', () => {
    expect(getAttestationErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(getAttestationErrorMessage(axiosError(400, '   ', ''), 'fallback')).toBe('fallback');
  });
});

describe('isDocumensoUnavailable', () => {
  it('recognises the not-configured 400 from the sign route', () => {
    expect(
      isDocumensoUnavailable(
        axiosError(400, 'Documenso signing is not configured for this practice or signer.')
      )
    ).toBe(true);
  });

  it('does not treat other failures as a missing integration', () => {
    expect(isDocumensoUnavailable(axiosError(400, 'Invalid request body'))).toBe(false);
    expect(isDocumensoUnavailable(axiosError(502, 'Documenso rejected the document'))).toBe(false);
    expect(isDocumensoUnavailable(new Error('Documenso'))).toBe(false);
  });
});

describe('getRecordOrigin', () => {
  it('names the uploader from the ids the document carries', () => {
    expect(getRecordOrigin({ ...baseRecord, uploadedByParentId: 'parent-1' })).toBe(
      'Uploaded by the pet parent'
    );
    expect(getRecordOrigin({ ...baseRecord, uploadedByPmsUserId: 'user-1' })).toBe(
      'Uploaded by the practice'
    );
    expect(getRecordOrigin(baseRecord)).toBe('Origin not recorded');
  });
});

describe('getReviewFields', () => {
  it('shows the record as the parent filed it', () => {
    const fields = getReviewFields({
      ...baseRecord,
      issueDate: '2026-01-01T10:00:00Z',
      issuingBusinessName: 'Bristol Vets',
      uploadedByParentId: 'parent-1',
    });

    expect(fields.map((field) => field.label)).toEqual([
      'Document',
      'Category',
      'Type',
      'Issue date',
      'Issued by',
      'Attachments',
      'Origin',
    ]);
    expect(fields[0].value).toBe('Rabies certificate');
    expect(fields[1].value).toBe('Health');
    expect(fields[2].value).toBe('Vaccination');
    expect(fields[3].value).not.toBe('Undated');
    expect(fields[4].value).toBe('Bristol Vets');
    expect(fields[5].value).toBe('1 file (PDF)');
    expect(fields[6].value).toBe('Uploaded by the pet parent');
  });

  it('marks missing values rather than dropping them', () => {
    const bare: CompanionRecord = {
      ...baseRecord,
      title: '   ',
      issueDate: undefined,
      issuingBusinessName: '  ',
      attachments: [],
    };

    expect(fieldValue(bare, 'Document')).toBe('Untitled document');
    expect(fieldValue(bare, 'Issue date')).toBe('Undated');
    expect(fieldValue(bare, 'Issued by')).toBe('-');
    expect(fieldValue(bare, 'Attachments')).toBe('No file attached');
    // A payload that omits `attachments` altogether reads the same way.
    expect(
      fieldValue(
        { ...baseRecord, attachments: undefined } as unknown as CompanionRecord,
        'Attachments'
      )
    ).toBe('No file attached');
  });

  it('summarises multiple attachments by count and distinct type', () => {
    expect(
      fieldValue(
        {
          ...baseRecord,
          attachments: [
            { key: 'a', mimeType: 'application/pdf' },
            { key: 'b', mimeType: 'image/jpeg' },
            { key: 'c' },
          ],
        },
        'Attachments'
      )
    ).toBe('3 files (PDF, JPEG, FILE)');
  });
});
