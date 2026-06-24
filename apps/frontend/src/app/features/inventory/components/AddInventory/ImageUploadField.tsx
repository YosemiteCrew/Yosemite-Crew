'use client';
import React, { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { RiUploadCloud2Fill } from 'react-icons/ri';
import { FiX } from 'react-icons/fi';
import {
  getInventoryItemImagePresignedUrl,
  uploadFileToS3,
} from '@/app/features/inventory/services/inventoryUploadService';
import { getSafeOrgImageUrl } from '@/app/lib/urls';

type Props = {
  label?: string;
  value: string;
  organisationId?: string;
  onChange: (url: string) => void;
};

const ImageUploadField = ({ label, value, organisationId, onChange }: Props) => {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const displayUrl = preview ?? getSafeOrgImageUrl(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);

    if (!organisationId) {
      setError('Organisation not loaded. Please try again.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setIsUploading(true);

    try {
      const { uploadUrl, s3Key } = await getInventoryItemImagePresignedUrl(
        organisationId,
        file.type
      );
      await uploadFileToS3(uploadUrl, file);
      onChange(s3Key);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
    } catch {
      setError('Upload failed. Please try again.');
      URL.revokeObjectURL(localPreview);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    onChange('');
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <div className="px-4 text-caption-1 text-text-secondary">{label}</div>}

      {displayUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-input-border-default bg-white">
          <Image
            src={displayUrl}
            alt="Product image"
            width={400}
            height={140}
            unoptimized={displayUrl.startsWith('blob:')}
            className="h-35 w-full object-cover"
          />
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove image"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white transition-colors"
            >
              <FiX size={14} />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <span className="text-body-4 text-text-secondary">Uploading…</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => document.getElementById(inputId)?.click()}
          className="flex min-h-35 w-full flex-col items-center justify-center rounded-2xl border border-input-border-default bg-white px-4 py-5 text-center text-text-primary disabled:opacity-60"
        >
          <RiUploadCloud2Fill size={34} className="text-blue-text" aria-hidden="true" />
          <span className="mt-2 text-body-4-emphasis">
            {isUploading ? 'Uploading…' : 'Upload image'}
          </span>
          <span className="text-caption-1 text-text-secondary">PNG, JPG, WebP · Max 2 MB</span>
        </button>
      )}

      <input
        id={inputId}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label={label || 'Upload inventory image'}
        onChange={handleFileChange}
      />

      {error && <div className="px-4 text-caption-1 text-red-600">{error}</div>}
    </div>
  );
};

export default ImageUploadField;
