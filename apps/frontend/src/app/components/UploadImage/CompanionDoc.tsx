import React, { useRef } from "react";
import axios from "axios";
import { FaCloudUploadAlt, FaFilePdf, FaTrashAlt } from "react-icons/fa";

import { postData } from "@/app/services/axios";

import "./UploadImage.css";

const allowedTypes = new Set(["application/pdf"]);

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
  error,
  companionId,
}: Readonly<Props>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const getSignedUrl = async (file: File): Promise<GetSignedUrlResponse> => {
    const body = {
      mimeType: file.type,
      companionId: companionId,
    };
    const res = await postData<GetSignedUrlResponse>(apiUrl, body);
    return res.data;
  };

  const uploadToS3 = async (uploadUrl: string, file: File) => {
    await axios.put(uploadUrl, file, {
      headers: { "Content-Type": file?.type },
      withCredentials: false,
    });
  };

  const validate = (f: File) => {
    if (!allowedTypes.has(f.type)) return false;
    if (f.size > 20 * 1024 * 1024) return false;
    return true;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const picked = Array.from(fileList)[0];
    if (!picked || !validate(picked)) return;
    setFile(picked);
    try {
      const signed = await getSignedUrl(picked);
      await uploadToS3(signed.url, picked);
      onChange(signed.key);
    } catch (err: any) {
      console.log(err);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = () => {
    setFile(null);
  };

  return (
    <>
      <button
        className="UploadAreaData"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="upldCont">
          <FaCloudUploadAlt className="upload-cloud" />
          <h6>{placeholder}</h6>
          <p>
            Only PDF
            <br />
            max size 20 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </button>

      {file && (
        <div
          className="flex items-center justify-center w-full rounded-2xl border border-grey-light relative px-2! py-6!"
          key={`file-${file.name}`}
        >
          <div className="flex flex-col gap-2 items-center">
            <FaFilePdf className="file-icon pdf" />
            <span className="max-w-[150px] text-[15px] font-satoshi font-medium text-grey-noti text-center truncate">
              {file.name}
            </span>
          </div>
          <FaTrashAlt
            className="absolute top-3 right-3 cursor-pointer"
            onClick={handleRemove}
            color="#ff3b30"
          />
        </div>
      )}
    </>
  );
};

export default CompanionDoc;
