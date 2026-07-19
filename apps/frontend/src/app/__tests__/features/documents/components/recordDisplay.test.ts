import {
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoFlaskOutline,
  IoWaterOutline,
} from 'react-icons/io5';
import { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import {
  filterRecords,
  getAttachmentSummary,
  getDocumentSource,
  getMonthGroupLabel,
  getRecordDateValue,
  getRecordIcon,
  getRecordStatusPills,
  groupRecordsByMonth,
  sortRecords,
} from '@/app/features/documents/components/recordDisplay';

const rec = (partial: Partial<CompanionRecord>): CompanionRecord => ({
  title: '',
  category: 'HEALTH',
  subcategory: 'OTHER',
  attachments: [],
  ...partial,
});

describe('recordDisplay', () => {
  describe('getRecordIcon', () => {
    it('maps a health sub-category to its typed glyph', () => {
      expect(getRecordIcon(rec({ subcategory: 'LAB_TEST' }))).toBe(IoFlaskOutline);
    });

    it('maps a hygiene sub-category to its typed glyph', () => {
      expect(getRecordIcon(rec({ subcategory: 'BATHING' }))).toBe(IoWaterOutline);
    });

    it('falls back to a document glyph for an unmapped synced record', () => {
      expect(getRecordIcon(rec({ subcategory: 'OTHER', syncedFromPms: true }))).toBe(
        IoDocumentTextOutline
      );
    });

    it('falls back to an upload glyph for an unmapped manual record', () => {
      expect(getRecordIcon(rec({ subcategory: 'OTHER' }))).toBe(IoCloudUploadOutline);
    });
  });

  describe('getDocumentSource', () => {
    it('prefers the issuing business name', () => {
      expect(getDocumentSource(rec({ issuingBusinessName: 'Alpenblick' }))).toBe('Alpenblick');
    });

    it('uses PMS for synced records', () => {
      expect(getDocumentSource(rec({ syncedFromPms: true }))).toBe('PMS');
    });

    it('uses Pet parent when a parent uploaded it', () => {
      expect(getDocumentSource(rec({ uploadedByParentId: 'p1' }))).toBe('Pet parent');
    });

    it('defaults to Staff', () => {
      expect(getDocumentSource(rec({}))).toBe('Staff');
    });
  });

  describe('getAttachmentSummary', () => {
    it('reports no attachments', () => {
      expect(getAttachmentSummary(rec({ attachments: [] }))).toBe('No attachments');
    });

    it('reports a single typed file', () => {
      expect(
        getAttachmentSummary(rec({ attachments: [{ key: 'k', mimeType: 'application/pdf' }] }))
      ).toBe('1 file (PDF)');
    });

    it('falls back to FILE when the mime type is missing', () => {
      expect(getAttachmentSummary(rec({ attachments: [{ key: 'k' }] }))).toBe('1 file (FILE)');
    });

    it('reports multiple files', () => {
      expect(
        getAttachmentSummary(
          rec({
            attachments: [
              { key: 'a', mimeType: 'image/png' },
              { key: 'b', mimeType: 'image/png' },
            ],
          })
        )
      ).toBe('2 files (PNG)');
    });
  });

  describe('getRecordStatusPills', () => {
    it('returns a success pill for synced records plus a PMS-visible pill', () => {
      expect(getRecordStatusPills(rec({ syncedFromPms: true, pmsVisible: true }))).toEqual([
        { label: 'Synced', tone: 'success' },
        { label: 'PMS visible', tone: 'info' },
      ]);
    });

    it('returns a warning pill for manual records', () => {
      expect(getRecordStatusPills(rec({}))).toEqual([{ label: 'Manual', tone: 'warning' }]);
    });
  });

  describe('date helpers', () => {
    it('parses a month bucket in UTC', () => {
      expect(getMonthGroupLabel(rec({ issueDate: '2026-01-01T10:00:00Z' }))).toBe('January 2026');
    });

    it('buckets undatable records under Undated', () => {
      expect(getMonthGroupLabel(rec({}))).toBe('Undated');
      expect(getMonthGroupLabel(rec({ issueDate: 'not-a-date' }))).toBe('Undated');
    });

    it('falls back to createdAt when there is no issue date', () => {
      expect(getMonthGroupLabel(rec({ createdAt: '2026-07-04T00:00:00Z' }))).toBe('July 2026');
    });

    it('returns an absolute value or null for the sort key', () => {
      expect(getRecordDateValue(rec({ issueDate: '2026-01-01T00:00:00Z' }))).toBe(
        Date.parse('2026-01-01T00:00:00Z')
      );
      expect(getRecordDateValue(rec({}))).toBeNull();
      expect(getRecordDateValue(rec({ issueDate: 'nope' }))).toBeNull();
    });
  });

  describe('filterRecords', () => {
    const synced = rec({ id: 's', syncedFromPms: true });
    const manual = rec({ id: 'm' });

    it('returns everything for ALL', () => {
      expect(filterRecords([synced, manual], 'ALL')).toHaveLength(2);
    });

    it('returns only manual uploads for UPLOADED', () => {
      expect(filterRecords([synced, manual], 'UPLOADED')).toEqual([manual]);
    });

    it('returns only synced records for SYNCED', () => {
      expect(filterRecords([synced, manual], 'SYNCED')).toEqual([synced]);
    });
  });

  describe('sortRecords', () => {
    const jan = rec({ id: 'jan', issueDate: '2026-01-01T00:00:00Z' });
    const mar = rec({ id: 'mar', issueDate: '2026-03-01T00:00:00Z' });
    const undated = rec({ id: 'undated' });

    it('sorts newest first by default', () => {
      expect(sortRecords([jan, mar], 'desc').map((r) => r.id)).toEqual(['mar', 'jan']);
    });

    it('sorts oldest first when ascending', () => {
      expect(sortRecords([mar, jan], 'asc').map((r) => r.id)).toEqual(['jan', 'mar']);
    });

    it('pushes undatable records to the end regardless of direction', () => {
      expect(sortRecords([undated, jan], 'desc').map((r) => r.id)).toEqual(['jan', 'undated']);
      expect(sortRecords([jan, undated], 'asc').map((r) => r.id)).toEqual(['jan', 'undated']);
    });

    it('keeps two undatable records in place', () => {
      const a = rec({ id: 'a' });
      const b = rec({ id: 'b' });
      expect(sortRecords([a, b], 'desc').map((r) => r.id)).toEqual(['a', 'b']);
    });
  });

  describe('groupRecordsByMonth', () => {
    it('buckets records by month, preserving order', () => {
      const groups = groupRecordsByMonth([
        rec({ id: 'jul1', issueDate: '2026-07-10T00:00:00Z' }),
        rec({ id: 'jul2', issueDate: '2026-07-02T00:00:00Z' }),
        rec({ id: 'jun', issueDate: '2026-06-12T00:00:00Z' }),
      ]);
      expect(groups.map((g) => g.label)).toEqual(['July 2026', 'June 2026']);
      expect(groups[0].items.map((r) => r.id)).toEqual(['jul1', 'jul2']);
      expect(groups[1].items.map((r) => r.id)).toEqual(['jun']);
    });
  });
});
