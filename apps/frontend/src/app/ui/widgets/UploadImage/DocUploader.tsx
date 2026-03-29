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
type GetSignedUrlResponse = { uploadUrl: string; s3Key: string };

const DocUploader = ({ onChange, apiUrl, placeholder, file, setFile }: Readonly<Props>) => {
  const getSignedUrl = async (file: File): Promise<GetSignedUrlResponse> => {
    const res = await postData<GetSignedUrlResponse>(apiUrl, {
      mimeType: file?.type,
    });
    return res.data;
  };

  return (
    <PdfDocUploader
      placeholder={placeholder}
      onChange={onChange}
      file={file}
      setFile={setFile}
      getSignedUrl={getSignedUrl}
    />
  );
};

export default DocUploader;
