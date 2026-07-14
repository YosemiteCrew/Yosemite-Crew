import React, { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { IoCamera } from 'react-icons/io5';
import { FiMinusCircle } from 'react-icons/fi';
import { postData } from '@/app/services/axios';
import axios from 'axios';
import { sanitizeUrl } from '@braintree/sanitize-url';

import './LogoUploader.css';

type LogoUploaderProps = {
  title: string;
  apiUrl: string;
  setImageUrl: (url: string) => void;
};
type GetSignedUrlResponse = { uploadUrl: string; s3Key: string };

const isSafePreviewUrl = (url: string) => url.startsWith('blob:');

const uploadLogoToS3 = async (uploadUrl: string, file: File) => {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file?.type },
    withCredentials: false,
  });
};

const LogoUploader = ({ title, apiUrl, setImageUrl }: LogoUploaderProps) => {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const getSignedUrl = async (file: File): Promise<GetSignedUrlResponse> => {
    const res = await postData<GetSignedUrlResponse>(apiUrl, {
      mimeType: file?.type,
    });
    return res.data;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError('Only non-SVG image files are supported.');
      setIsUploading(false);
      return;
    }
    const localUrl = URL.createObjectURL(file);
    if (!isSafePreviewUrl(localUrl)) {
      setError('Invalid preview source');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(localUrl);
    try {
      const signed = await getSignedUrl(file);
      await uploadLogoToS3(signed.uploadUrl, file);
      setImageUrl(signed.s3Key);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
      handleRemoveImage();
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
  };

  return (
    <div className="step-logo-container">
      <div className="step-logo-upload">
        {preview && isSafePreviewUrl(preview) && sanitizeUrl(preview) !== 'about:blank' ? (
          <>
            <Image
              src={sanitizeUrl(preview)}
              alt="Logo Preview"
              width={58}
              height={58}
              unoptimized
              className="step-logo-preview rounded-full object-cover"
            />
            <button
              type="button"
              className="remove-icon"
              onClick={handleRemoveImage}
              aria-label="Remove uploaded logo"
            >
              <FiMinusCircle color="var(--color-primary-500)" size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <input
              type="file"
              id={inputId}
              aria-label="Upload logo image"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            <label htmlFor={inputId} style={{ cursor: 'pointer' }} aria-label={title}>
              <IoCamera color="var(--color-neutral-700)" size={32} aria-hidden="true" />
            </label>
          </>
        )}
      </div>
      <div className="step-logo-title-container">
        <div className="step-logo-title" aria-live="polite">
          {isUploading ? 'Uploading...' : title}
        </div>
        {error && (
          <div className="text-red-600 text-sm" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoUploader;
