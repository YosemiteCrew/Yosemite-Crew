import type { TemplateLike } from '@yosemite-crew/types';
import { dedupeTemplates, listTemplates } from '@/app/features/forms/services/templateListShared';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

const template = (id: string, name = id) => ({ id, name }) as unknown as TemplateLike;

describe('templateListShared', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('fetches the url with the given params and returns the array response', async () => {
      (getData as jest.Mock).mockResolvedValue({ data: [template('tpl-1')] });

      const result = await listTemplates('/v1/templates/pms/templates/library', {
        kind: 'SOAP_NOTE',
        status: 'PUBLISHED',
      });

      expect(getData).toHaveBeenCalledWith('/v1/templates/pms/templates/library', {
        kind: 'SOAP_NOTE',
        status: 'PUBLISHED',
      });
      expect(result).toEqual([expect.objectContaining({ id: 'tpl-1' })]);
    });

    it('defaults params to an empty object', async () => {
      (getData as jest.Mock).mockResolvedValue({ data: [] });

      await listTemplates('/v1/templates/pms/templates/library');

      expect(getData).toHaveBeenCalledWith('/v1/templates/pms/templates/library', {});
    });

    it('returns an empty list for non-array responses', async () => {
      (getData as jest.Mock).mockResolvedValue({ data: { id: 'not-a-list' } });

      await expect(listTemplates('/v1/templates/pms/templates/library')).resolves.toEqual([]);
    });
  });

  describe('dedupeTemplates', () => {
    it('dedupes by id with later entries winning while keeping first-seen order', () => {
      const result = dedupeTemplates([
        template('tpl-1', 'Library version'),
        template('tpl-2'),
        template('tpl-1', 'Org version'),
      ]);

      expect(result).toEqual([
        expect.objectContaining({ id: 'tpl-1', name: 'Org version' }),
        expect.objectContaining({ id: 'tpl-2' }),
      ]);
    });

    it('drops entries without an id', () => {
      const result = dedupeTemplates([
        template(''),
        undefined as unknown as TemplateLike,
        template('tpl-1'),
      ]);

      expect(result).toEqual([expect.objectContaining({ id: 'tpl-1' })]);
    });
  });
});
