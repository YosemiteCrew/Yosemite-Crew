import { useServiceStore } from '@/app/stores/serviceStore';
import { Service } from '@yosemite-crew/types';
import { deleteService } from '@/app/features/organization/services/serviceService';

const deleteDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  deleteData: (...args: any[]) => deleteDataMock(...args),
  getData: jest.fn(),
  postData: jest.fn(),
  default: { get: jest.fn() },
}));

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: { getState: jest.fn() },
}));

describe('deleteService', () => {
  const deleteServiceByIdMock = jest.fn();
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
    (useServiceStore.getState as jest.Mock).mockReturnValue({
      deleteServiceById: deleteServiceByIdMock,
    });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('deletes the service by id and updates the store', async () => {
    deleteDataMock.mockResolvedValue({});
    const service = { id: 'svc-1' } as unknown as Service;

    await deleteService(service);

    expect(deleteDataMock).toHaveBeenCalledWith('/fhir/v1/service/svc-1');
    expect(deleteServiceByIdMock).toHaveBeenCalledWith('svc-1');
  });

  it('throws and logs when the service has no id', async () => {
    const service = { id: undefined } as unknown as Service;

    await expect(deleteService(service)).rejects.toThrow('Service ID is missing.');
    expect(deleteDataMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete service:',
      expect.objectContaining({ message: 'Service ID is missing.' })
    );
  });

  it('logs and rethrows when the delete request fails', async () => {
    const err = new Error('network down');
    deleteDataMock.mockRejectedValue(err);
    const service = { id: 'svc-1' } as unknown as Service;

    await expect(deleteService(service)).rejects.toThrow('network down');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete service:', err);
  });
});
