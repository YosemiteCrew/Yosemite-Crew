import {
  createDraftImport,
  discardDraftImport,
  getDraftImport,
} from '@/app/services/formDraftImportService';
import { getData, postData, deleteData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
}));

const getDataMock = getData as jest.Mock;
const postDataMock = postData as jest.Mock;
const deleteDataMock = deleteData as jest.Mock;

const VIEW = {
  id: 'd1',
  organisationId: 'org1',
  sourceFormId: null,
  draftFormId: 'f1',
  suppliedText: 'Patient name | input | required',
  fields: [],
  unsupportedConstructs: [],
  diff: [],
  stale: false,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

describe('formDraftImportService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createDraftImport', () => {
    it('posts to the org-scoped endpoint and unwraps the envelope', async () => {
      postDataMock.mockResolvedValue({ data: { data: VIEW } });
      const result = await createDraftImport('org1', { suppliedText: 'x' });
      expect(postDataMock).toHaveBeenCalledWith('/v1/form-draft-imports/org1', {
        suppliedText: 'x',
      });
      expect(result).toEqual(VIEW);
    });
  });

  describe('getDraftImport', () => {
    it('gets by org and id and unwraps the envelope', async () => {
      getDataMock.mockResolvedValue({ data: { data: VIEW } });
      const result = await getDraftImport('org1', 'd1');
      expect(getDataMock).toHaveBeenCalledWith('/v1/form-draft-imports/org1/d1');
      expect(result).toEqual(VIEW);
    });
  });

  describe('discardDraftImport', () => {
    it('deletes by org and id', async () => {
      deleteDataMock.mockResolvedValue({});
      await discardDraftImport('org1', 'd1');
      expect(deleteDataMock).toHaveBeenCalledWith('/v1/form-draft-imports/org1/d1');
    });
  });
});
