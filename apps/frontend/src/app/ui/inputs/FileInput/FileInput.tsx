import React from 'react';
import { IoCloudUpload } from 'react-icons/io5';

import './FileInput.css';

const FileInput = () => {
  return (
    <>
      <input
        type="file"
        style={{ display: 'none' }}
        id="file-professioal-upload"
        aria-label="Upload documents (optional)"
      />
      <label htmlFor="file-professioal-upload" className="file-input-label">
        <IoCloudUpload color="var(--ink-faint)" size={32} />
        <div className="upload-title">Upload documents (optional)</div>
        <div className="upload-desc">
          Only DOC, PDF, PNG, and JPEG formats, with maximum size of 5 MB.
        </div>
      </label>
    </>
  );
};

export default FileInput;
