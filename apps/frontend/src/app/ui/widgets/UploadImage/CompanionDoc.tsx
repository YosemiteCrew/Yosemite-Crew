import React from 'react';
import { postData } from '@/app/services/axios';
import PdfDocUploader from '@/app/ui/widgets/UploadImage/PdfDocUploader';

type Props = {
  placeholder: string;
  onChange: (url: string, mimeType?: string, size?: number) => void;
  apiUrl: string;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  error?: string;
  companionId: string;
};
type UploadResponse = { s3Key: string };

const CompanionDoc = ({
  onChange,
  apiUrl,
  placeholder,
  file,
  setFile,
  companionId,
}: Readonly<Props>) => {
  const uploadFile = async (file: File): Promise<UploadResponse> => {
    const body = new FormData();
    body.append('file', file);
    body.append('patientId', companionId);
    const res = await postData<UploadResponse>(apiUrl, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  };

  return (
    <PdfDocUploader
      placeholder={placeholder}
      onChange={onChange}
      file={file}
      setFile={setFile}
      uploadFile={uploadFile}
    />
  );
};

export default CompanionDoc;
