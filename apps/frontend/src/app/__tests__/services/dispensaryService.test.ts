import {
  listDispenseRequests,
  getDispenseRequest,
  fetchPrescriptionLabelPdf,
} from '@/app/features/inventory/services/dispensaryService';
import * as axiosService from '@/app/services/axios';
import api, { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  getData: jest.fn(),
}));

describe('dispensaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDispenseRequests', () => {
    it('fetches dispense requests without a status filter', async () => {
      const mockData = [{ id: 'req-1' }];
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await listDispenseRequests('org-1');

      expect(getData).toHaveBeenCalledWith(
        '/v1/prescriptions/organisations/org-1/prescription-dispense-requests'
      );
      expect(result).toEqual(mockData);
    });

    it('fetches dispense requests with a status filter', async () => {
      const mockData = [{ id: 'req-2' }];
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await listDispenseRequests('org-1', 'PENDING');

      expect(getData).toHaveBeenCalledWith(
        '/v1/prescriptions/organisations/org-1/prescription-dispense-requests?status=PENDING'
      );
      expect(result).toEqual(mockData);
    });

    it('propagates errors from the API call', async () => {
      const error = new Error('Network error');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(listDispenseRequests('org-1')).rejects.toThrow('Network error');
    });
  });

  describe('getDispenseRequest', () => {
    it('fetches a single dispense request by id', async () => {
      const mockData = { id: 'req-1', status: 'PENDING' };
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await getDispenseRequest('org-1', 'req-1');

      expect(getData).toHaveBeenCalledWith(
        '/v1/prescriptions/organisations/org-1/prescription-dispense-requests/req-1'
      );
      expect(result).toEqual(mockData);
    });

    it('propagates errors from the API call', async () => {
      const error = new Error('Not found');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);

      await expect(getDispenseRequest('org-1', 'req-x')).rejects.toThrow('Not found');
    });
  });

  describe('fetchPrescriptionLabelPdf', () => {
    it('fetches the label pdf as a blob', async () => {
      const mockBlob = new Blob(['pdf-content']);
      (api.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      const result = await fetchPrescriptionLabelPdf('org-1', 'presc-1');

      expect(api.get).toHaveBeenCalledWith(
        '/v1/prescriptions/organisations/org-1/presc-1/label.pdf',
        { responseType: 'blob' }
      );
      expect(result).toEqual(mockBlob);
    });

    it('propagates errors from the API call', async () => {
      const error = new Error('PDF fetch failed');
      (api.get as jest.Mock).mockRejectedValue(error);

      await expect(fetchPrescriptionLabelPdf('org-1', 'presc-1')).rejects.toThrow(
        'PDF fetch failed'
      );
    });
  });
});
