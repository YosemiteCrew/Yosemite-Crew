import axios from 'axios';
import {
  getInventoryItemImagePresignedUrl,
  uploadFileToS3,
} from '@/app/features/inventory/services/inventoryUploadService';

const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  postData: (...args: any[]) => postDataMock(...args),
  getData: jest.fn(),
  deleteData: jest.fn(),
  default: { get: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { put: jest.fn() },
}));

describe('getInventoryItemImagePresignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests a presigned upload url for the organisation and mime type', async () => {
    const responseData = { uploadUrl: 'https://s3.example.com/upload', s3Key: 'items/abc.png' };
    postDataMock.mockResolvedValue({ data: responseData });

    const result = await getInventoryItemImagePresignedUrl('org-1', 'image/png');

    expect(postDataMock).toHaveBeenCalledWith('/v1/inventory/organisation/org-1/items/upload-url', {
      mimeType: 'image/png',
    });
    expect(result).toEqual(responseData);
  });
});

describe('uploadFileToS3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUTs the file to the presigned url with the file content type and no credentials', async () => {
    (axios.put as jest.Mock).mockResolvedValue({});
    const file = new File(['content'], 'photo.png', { type: 'image/png' });

    await uploadFileToS3('https://s3.example.com/upload', file);

    expect(axios.put).toHaveBeenCalledWith('https://s3.example.com/upload', file, {
      headers: { 'Content-Type': 'image/png' },
      withCredentials: false,
    });
  });
});
