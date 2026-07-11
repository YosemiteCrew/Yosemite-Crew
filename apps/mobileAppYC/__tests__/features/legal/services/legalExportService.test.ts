import {Share} from 'react-native';
import {
  buildLegalPlainText,
  exportLegalDocument,
} from '../../../../src/features/legal/services/legalExportService';
import type {LegalSection} from '../../../../src/features/legal/data/legalContentTypes';

const sections: LegalSection[] = [
  {
    id: 's1',
    title: 'Section 1',
    blocks: [
      {
        type: 'paragraph',
        segments: [{text: 'Hello '}, {text: 'world'}],
      },
      {
        type: 'ordered-list',
        items: [
          {marker: '1.', segments: [{text: 'First'}]},
          {marker: '2.', segments: [{text: 'Second'}]},
        ],
      },
    ],
  },
  // Empty section (no title, no blocks) exercises the filter-out path.
  {id: 's2', title: '', blocks: []},
];

describe('legalExportService', () => {
  describe('buildLegalPlainText', () => {
    it('includes the meta heading and flattens paragraph + list blocks', () => {
      const out = buildLegalPlainText('Terms', sections, {
        lastUpdated: '10 Jul 2026',
        version: 'v1.0',
      });

      expect(out).toContain('Terms\nLast updated 10 Jul 2026 · v1.0');
      expect(out).toContain('Section 1');
      expect(out).toContain('Hello world');
      expect(out).toContain('1. First');
      expect(out).toContain('2. Second');
      // The empty section is dropped.
      expect(out).not.toContain('undefined');
    });

    it('omits the last-updated line when no meta is provided', () => {
      const out = buildLegalPlainText('Privacy', sections);
      expect(out.startsWith('Privacy')).toBe(true);
      expect(out).not.toContain('Last updated');
    });

    it('handles a non-array sections value defensively', () => {
      expect(
        buildLegalPlainText('X', undefined as unknown as LegalSection[]),
      ).toContain('X');
    });

    it('handles a section whose blocks are not an array', () => {
      const out = buildLegalPlainText('Doc', [
        {id: 'g', title: 'Guard', blocks: undefined as never},
      ]);
      expect(out).toContain('Guard');
    });

    it('drops blocks that produce only whitespace', () => {
      const out = buildLegalPlainText('Doc', [
        {
          id: 'e',
          title: 'Section E',
          blocks: [
            {type: 'paragraph', segments: [{text: '   '}]},
            {type: 'paragraph', segments: [{text: 'Kept line'}]},
          ],
        },
      ]);
      expect(out).toContain('Section E');
      expect(out).toContain('Kept line');
    });
  });

  describe('exportLegalDocument', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('opens the share sheet with the built document', async () => {
      const spy = jest
        .spyOn(Share, 'share')
        .mockResolvedValue({action: 'sharedAction'} as never);

      await exportLegalDocument('Terms', sections, {
        lastUpdated: '10 Jul 2026',
        version: 'v1.0',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Terms',
          message: expect.stringContaining('Section 1'),
        }),
        expect.objectContaining({subject: 'Terms'}),
      );
    });

    it('silently ignores a dismissed share sheet', async () => {
      jest
        .spyOn(Share, 'share')
        .mockRejectedValue(new Error('User did not share'));

      await expect(
        exportLegalDocument('Terms', sections),
      ).resolves.toBeUndefined();
    });
  });
});
