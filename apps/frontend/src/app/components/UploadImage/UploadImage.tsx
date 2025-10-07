import React, { useRef, useState, useEffect } from "react";
import {
  FaCloudUploadAlt,
  FaFilePdf,
  FaFileWord,
  FaFileImage,
  FaTrashAlt,
} from "react-icons/fa";
import Image from "next/image";
import { Button } from "react-bootstrap";

import "./UploadImage.css";

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

function getFileIcon(type: string) {
  if (type === "application/pdf")
    return <FaFilePdf className="file-icon pdf" />;
  if (type.includes("word")) return <FaFileWord className="file-icon word" />;
  if (type.startsWith("image/"))
    return <FaFileImage className="file-icon img" />;
  return <FaFileImage className="file-icon" />;
}

type ExistingFile = {
  name: string; // example: "abc.pdf"
  type: string; // example: "application/pdf"
  url: string; // example: S3 URL
};

type Props = {
  onChange?: (files: File[]) => void;
  value?: File[];
  existingFiles?: ExistingFile[];
};

const UploadImage = ({
  onChange,
  value = [],
  existingFiles = [],
}: Readonly<Props>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(value);
  const [apiFiles, setApiFiles] = useState<ExistingFile[]>(existingFiles);

  useEffect(() => {
    setFiles(value);
  }, [value]);

  useEffect(() => {
    setApiFiles(existingFiles);
  }, [existingFiles]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter(
      (file) =>
        allowedTypes.includes(file.type) && file.size <= 20 * 1024 * 1024
    );
    setFiles((prev) => {
      const merged = [...prev, ...newFiles];
      if (onChange) onChange(merged);
      return merged;
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    if (onChange) onChange(updated);
  };

  const handleDeleteExisting = (idx: number) => {
    const updated = apiFiles.filter((_, i) => i !== idx);
    setApiFiles(updated);
    // Optionally: notify parent via callback
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
          <h6>Upload Certifications/ Degrees</h6>
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
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </button>

      <div className="upload-preview-list">
        {/* New user-selected files */}
        {files.map((file, idx) => (
          <div className="upload-preview-item" key={`file-${file.name}`}>
            {file.type.startsWith("image/") ? (
              <Image
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="preview-img"
                width={100}
                height={100}
                onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
              />
            ) : (
              <div className="preview-doc">
                {getFileIcon(file.type)}
                <span className="file-name">{file.name}</span>
              </div>
            )}
            <Button className="delete-btn" onClick={() => handleDelete(idx)}>
              <FaTrashAlt />
            </Button>
          </div>
        ))}

        {/* API/S3 existing files */}
        {apiFiles.map((file, idx) => (
          <div className="upload-preview-item" key={`api-${file.name}`}>
            {file.type.startsWith("image/") ? (
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
            <Button
              className="delete-btn"
              onClick={() => handleDeleteExisting(idx)}
            >
              <FaTrashAlt />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
};

export default UploadImage;
