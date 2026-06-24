import { postData } from '@/app/services/axios';
import axios from 'axios';

type PresignedUrlResponse = { uploadUrl: string; s3Key: string };

export const getInventoryItemImagePresignedUrl = async (
  organisationId: string,
  mimeType: string
): Promise<PresignedUrlResponse> => {
  const res = await postData<PresignedUrlResponse>(
    `/v1/inventory/organisation/${organisationId}/items/upload-url`,
    { mimeType }
  );
  return res.data;
};

export const uploadFileToS3 = async (uploadUrl: string, file: File): Promise<void> => {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    withCredentials: false,
  });
};
