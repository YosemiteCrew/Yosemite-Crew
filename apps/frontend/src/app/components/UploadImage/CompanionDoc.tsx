import React from "react";
import { postData } from "@/app/services/axios";
import PdfDocUploader from "./PdfDocUploader";

type Props = {
  placeholder: string;
  onChange: (url: string) => void;
  apiUrl: string;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  error?: string;
  companionId: string;
};
type GetSignedUrlResponse = { url: string; key: string };

const CompanionDoc = ({
  onChange,
  apiUrl,
  placeholder,
  file,
  setFile,
  companionId,
}: Readonly<Props>) => {
  const getSignedUrl = async (
    file: File,
  ): Promise<{ uploadUrl: string; s3Key: string }> => {
    const body = {
      mimeType: file.type,
      companionId: companionId,
    };
    const res = await postData<GetSignedUrlResponse>(apiUrl, body);
    return { uploadUrl: res.data.url, s3Key: res.data.key };
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

export default CompanionDoc;
