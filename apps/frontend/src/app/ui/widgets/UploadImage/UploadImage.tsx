import React, { useEffect, useRef, useState } from 'react';
import {
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoImageOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import Image from 'next/image';

import './UploadImage.css';

const allowedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);

const DEFAULT_FILES: File[] = [];
const DEFAULT_EXISTING_FILES: ExistingFile[] = [];
/**
 * One object URL per image in the list, minted and released as a batch: an object
 * URL pins its File in memory for the whole document lifetime until it is revoked.
 *
 * `release` defers the revoke by a tick and `hold` cancels a pending one, because
 * React's dev-only remount tears an effect down and sets it straight back up with
 * the same batch — revoking on the spot there would leave every thumbnail broken.
 */
const mintPreviews = (list: File[]) => {
  const urls = new Map<File, string>();
  for (const file of list) {
    if (file.type.startsWith('image/')) urls.set(file, URL.createObjectURL(file));
  }
  let pending: ReturnType<typeof setTimeout> | null = null;
  const hold = () => {
    if (pending) clearTimeout(pending);
    pending = null;
  };
  const release = () => {
    pending = setTimeout(() => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    }, 0);
  };
  return { urls, hold, release };
};

function getFileIcon(type: string) {
  if (type === 'application/pdf') return <IoDocumentTextOutline className="file-icon pdf" />;
  if (type.includes('word')) return <IoDocumentTextOutline className="file-icon word" />;
  if (type.startsWith('image/')) return <IoImageOutline className="file-icon img" />;
  return <IoImageOutline className="file-icon" />;
}

type ExistingFile = {
  name: string; // example: "abc.pdf"
  type: string; // example: "application/pdf"
  url: string; // example: S3 URL
};

type Props = {
  placeholder: string;
  onChange?: (files: File[]) => void;
  value?: File[];
  existingFiles?: ExistingFile[];
};

const UploadImage = ({
  onChange,
  value = DEFAULT_FILES,
  existingFiles = DEFAULT_EXISTING_FILES,
  placeholder,
}: Readonly<Props>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(value);
  const [apiFiles, setApiFiles] = useState<ExistingFile[]>(existingFiles);
  const [previews, setPreviews] = useState(() => mintPreviews(value));

  // Release the batch as soon as a newly minted one replaces it, and on unmount.
  useEffect(() => {
    previews.hold();
    return previews.release;
  }, [previews]);

  const applyFiles = (next: File[]) => {
    setFiles(next);
    setPreviews(mintPreviews(next));
    if (onChange) onChange(next);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList ?? []).filter(
      (file) => allowedTypes.has(file.type) && file.size <= 20 * 1024 * 1024
    );
    applyFiles([...files, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = (idx: number) => {
    applyFiles(files.filter((_, i) => i !== idx));
  };

  const handleDeleteExisting = (idx: number) => {
    const updated = apiFiles.filter((_, i) => i !== idx);
    setApiFiles(updated);
    // Optionally: notify parent via callback
  };

  return (
    <>
      <button
        type="button"
        className="UploadAreaData"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        aria-label={placeholder}
      >
        <div className="upldCont">
          <IoCloudUploadOutline className="upload-cloud" />
          <h6>{placeholder}</h6>
          <p>
            Only DOC, PDF, PNG, JPEG formats with
            <br />
            max size 20 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpeg,.jpg"
            style={{ display: 'none' }}
            aria-label={placeholder}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </button>

      <div className="upload-preview-list">
        {/* New user-selected files */}
        {files.map((file, idx) => (
          <div className="upload-preview-item" key={`file-${file.name}`}>
            {file.type.startsWith('image/') ? (
              previews.urls.get(file) && (
                <Image
                  src={previews.urls.get(file) as string}
                  alt={file.name}
                  className="preview-img"
                  width={100}
                  height={100}
                />
              )
            ) : (
              <div className="preview-doc">
                {getFileIcon(file.type)}
                <span className="file-name">{file.name}</span>
              </div>
            )}
            <button
              type="button"
              className="delete-btn"
              onClick={() => handleDelete(idx)}
              aria-label={`Remove ${file.name}`}
            >
              <IoTrashOutline />
            </button>
          </div>
        ))}

        {/* API/S3 existing files */}
        {apiFiles.map((file, idx) => (
          <div className="upload-preview-item" key={`api-${file.name}`}>
            {file.type.startsWith('image/') ? (
              <Image
                src={file.url}
                alt={file.name}
                className="preview-img"
                width={100}
                height={100}
              />
            ) : (
              <div className="preview-doc">
                {getFileIcon(file.type)}
                <span className="file-name">{file.name}</span>
              </div>
            )}
            <button
              type="button"
              className="delete-btn"
              onClick={() => handleDeleteExisting(idx)}
              aria-label={`Remove ${file.name}`}
            >
              <IoTrashOutline />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default UploadImage;
