import React, { useEffect, useMemo, useRef, useState } from "react";
import CenterModal from "../Modal/CenterModal";
import Image from "next/image";
import { isHttpsImageUrl } from "@/app/utils/urls";
import { MdArrowRightAlt } from "react-icons/md";
import { Primary, Secondary } from "../Buttons";
import { postData } from "@/app/services/axios";
import axios from "axios";
import { IoCamera } from "react-icons/io5";

type LogoUpdatorProps = {
  imageUrl?: string;
  size?: number;
  title: string;
  apiUrl: string;
  onSave: (s3Key: string) => Promise<void> | void;
  disabled?: boolean;
};

type GetSignedUrlResponse = { uploadUrl: string; s3Key: string };

const LogoUpdator = ({
  imageUrl,
  apiUrl,
  title,
  onSave,
  disabled,
  size = 40,
}: LogoUpdatorProps) => {
  const [updatePopup, setUpdatePopup] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const inputId = useMemo(
    () => `logo-updator-${Math.random().toString(16).slice(2)}`,
    []
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const normalizedImageUrl = useMemo(() => {
    if (imageUrl && isHttpsImageUrl(imageUrl)) return imageUrl;
    return "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png";
  }, [imageUrl]);

  const resetSelection = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCancel = () => {
    setUpdatePopup(false);
    resetSelection();
  };

  const getSignedUrl = async (f: File): Promise<GetSignedUrlResponse> => {
    const res = await postData<GetSignedUrlResponse>(apiUrl, {
      mimeType: f.type,
    });
    return res.data;
  };

  const uploadToS3 = async (uploadUrl: string, f: File) => {
    await axios.put(uploadUrl, f, {
      headers: { "Content-Type": f.type },
      withCredentials: false,
    });
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadError(null);
    const localUrl = URL.createObjectURL(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(localUrl);
    setFile(f);
  };

  const handleUpdate = async () => {
    if (!apiUrl) {
      setUploadError("Profile is not ready yet.");
      return;
    }
    if (disabled || isUploading) return;
    if (!file) {
      setUploadError("Please choose an image to upload.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const signed = await getSignedUrl(file);
      await uploadToS3(signed.uploadUrl, file);
      await onSave(signed.s3Key);
      setUpdatePopup(false);
      resetSelection();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Image
          src={normalizedImageUrl}
          alt="Logo"
          height={size}
          width={size}
          onClick={() => !disabled && setUpdatePopup(true)}
          className="rounded-full cursor-pointer h-10 w-10 object-cover"
        />
      </div>
      <CenterModal
        showModal={updatePopup}
        setShowModal={setUpdatePopup}
        onClose={handleCancel}
      >
        <div className="flex flex-col gap-8">
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">{title}</div>
          </div>
          <div className="flex gap-6 sm:gap-10 items-center justify-center w-full px-3">
            <Image
              src={normalizedImageUrl}
              alt="Logo"
              height={100}
              width={100}
              onClick={() => setUpdatePopup(true)}
              className="rounded-full h-[100px] w-[100px] object-cover"
            />
            <MdArrowRightAlt size={24} color="#302f2e" />
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <input
                  ref={fileRef}
                  type="file"
                  id={inputId}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handlePickFile}
                  className="hidden"
                />
                <label
                  htmlFor={inputId}
                  className={`h-[100px] w-[100px] relative rounded-full bg-white hover:bg-card-hover! transition-all duration-200 border-text-primary! cursor-pointer flex items-center justify-center ${preview ? "border-0" : "border"} ${isUploading ? "pointer-events-none" : ""}`}
                  aria-label="Upload logo"
                >
                  {preview ? (
                    <Image
                      src={preview}
                      alt="New Logo"
                      height={100}
                      width={100}
                      className="rounded-full object-cover h-[100px] w-[100px]"
                    />
                  ) : (
                    <IoCamera
                      size={40}
                      className="text-text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    />
                  )}
                </label>
              </div>
              {uploadError && (
                <div className="text-sm text-red-600 text-center max-w-[220px]">
                  {uploadError}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Secondary href="#" text="Cancel" onClick={handleCancel} />
            <Primary
              href="#"
              onClick={handleUpdate}
              text={isUploading ? "Updating..." : "Update"}
            />
          </div>
        </div>
      </CenterModal>
    </>
  );
};

export default LogoUpdator;
