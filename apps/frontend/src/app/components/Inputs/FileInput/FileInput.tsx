import React from "react";
import { RiUploadCloud2Fill } from "react-icons/ri";

import "./FileInput.css";

const FileInput = () => {
  return (
    <>
      <input
        type="file"
        style={{ display: "none" }}
        id="file-professioal-upload"
        aria-label="Upload documents (optional)"
      />
      <label htmlFor="file-professioal-upload" className="file-input-label">
        <RiUploadCloud2Fill color="#000" size={40} />
        <div className="upload-title">Upload documents (optional)</div>
        <div className="upload-desc">
          Only DOC, PDF, PNG, and JPEG formats, with maximum size of 5 MB.
        </div>
      </label>
    </>
  );
};

export default FileInput;
