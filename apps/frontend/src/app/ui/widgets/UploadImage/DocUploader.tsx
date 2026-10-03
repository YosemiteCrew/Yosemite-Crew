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
};
const DocUploader = ({ onChange, apiUrl, placeholder, file, setFile }: Readonly<Props>) => {
  const uploadFile = async (file: File): Promise<{ s3Key: string }> => {
    const body = new FormData();
    body.append('file', file);
    const res = await postData<{ s3Key: string }>(apiUrl, body, {
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

export default DocUploader;
