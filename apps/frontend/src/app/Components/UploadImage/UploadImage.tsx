import React, { useRef, useState } from 'react'
import "./UploadImage.css"
import { FaCloudUploadAlt, FaFilePdf, FaFileWord, FaFileImage, FaTrashAlt } from "react-icons/fa";
import Image from 'next/image';
import { Button } from 'react-bootstrap';

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
];

function getFileIcon(type: string) {
  if (type === "application/pdf") return <FaFilePdf className="file-icon pdf" />;
  if (type === "application/msword" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return <FaFileWord className="file-icon word" />;
  if (type.startsWith("image/")) return <FaFileImage className="file-icon img" />;
  return <FaFileImage className="file-icon" />;
}

function UploadImage() {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList).filter(file =>
      allowedTypes.includes(file.type) && file.size <= 20 * 1024 * 1024
    );
    setFiles(prev => [...prev, ...arr]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="UploadAreaData"onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={handleDrop} >
        <div className="upldCont">
            <FaCloudUploadAlt className="upload-cloud" />
            <h6>Upload Certifications/ Degrees</h6>
            <p> Only DOC, PDF, PNG, JPEG formats with<br />max size 20 MB</p>
            <input ref={inputRef} type="file"multiple
                accept=".pdf,.doc,.docx,.png,.jpeg,.jpg"
                style={{ display: "none" }}
                onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="upload-preview-list">
        {files.map((file, idx) => (
          <div className="upload-preview-item" key={idx}>
            {file.type.startsWith("image/") ? (
              <Image
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="preview-img"
                onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                width={100}
                height={100}
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
      </div>
    </>
  )
}

export default UploadImage