import React, { useEffect, useState } from "react";
import { IoCamera } from "react-icons/io5";
import { FiMinusCircle } from "react-icons/fi";
import { postData } from "@/app/services/axios";
import axios from "axios";

import "./LogoUploader.css";

type LogoUploaderProps = {
  title: string;
  apiUrl: string;
  setFormData: any;
};
type GetSignedUrlResponse = { uploadUrl: string; fileUrl: string };

const LogoUploader = ({ title, apiUrl, setFormData }: LogoUploaderProps) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const getSignedUrl = async (file: File): Promise<GetSignedUrlResponse> => {
    const res = await postData<GetSignedUrlResponse>(apiUrl, {
      filename: file.name,
      contentType: file.type,
    });
    return res.data;
  };

  const uploadToS3 = async (uploadUrl: string, file: File) => {
    await axios.put(uploadUrl, file, {
      headers: { "Content-Type": file.type },
      withCredentials: false,
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    const localUrl = URL.createObjectURL(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(localUrl);
    setImage(file);
    try {
      const signed = await getSignedUrl(file);
      await uploadToS3(signed.uploadUrl, file);
      setUrl(signed.fileUrl);
      setFormData((e: any) => ({ ...e, logoURL: url }));
      console.log(url, image);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
      handleRemoveImage();
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    setUrl(null);
    setError(null);
  };

  return (
    <div className="step-logo-container">
      <div className="step-logo-upload">
        {preview ? (
          <>
            <img
              src={preview}
              alt="Logo Preview"
              style={{
                width: 100,
                height: 100,
                objectFit: "cover",
                borderRadius: "50%",
              }}
              className="step-logo-preview"
            />
            <button className="remove-icon" onClick={handleRemoveImage}>
              <FiMinusCircle color="#247AED" size={16} />
            </button>
          </>
        ) : (
          <>
            <input
              type="file"
              id="logo-upload"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
            <label htmlFor="logo-upload" style={{ cursor: "pointer" }}>
              <IoCamera color="#247AED" size={40} />
            </label>
          </>
        )}
      </div>
      <div className="step-logo-title-container">
        <div className="step-logo-title">
          {isUploading ? "Uploading..." : title}
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>
    </div>
  );
};

export default LogoUploader;
