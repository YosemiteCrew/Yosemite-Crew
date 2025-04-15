import React, { useState, useEffect } from 'react';
import './UplodeImage.css';
// import Upload from '../../../../public/Images/uplode.png';

const UplodeImage = ({ onFileChange, selectedFiles }) => {
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    const uploadedFiles = Array.from(e.target.files);

    if (uploadedFiles.length > 0) {
      const updatedFiles = [...files, ...uploadedFiles]; // Append new files
      setFiles(updatedFiles);
      onFileChange(updatedFiles);
    }
  };

  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
    }
  }, [selectedFiles]);

  return (
    <div>
      <div className="upload-box">
        {files.length > 0 ? (
          <div className="file-preview">
            {files.map((file, index) => {
              const fileType = file.type;
              const isImage = fileType.startsWith('image/');
              return (
                <div key={index} className="file-item">
                  {isImage && file instanceof File ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index}`}
                      className="preview-image"
                    />
                  ) : (
                    <p className="file-name">{file.name}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <img src={`${import.meta.env.VITE_BASE_IMAGE_URL}/uplode.png`} alt="Upload Icon" />
            </div>
            <p className="upload-text">Upload files</p>
            <p className="file-info">
              Only DOC, PDF, PNG, JPEG formats <br /> with max size 20 MB
            </p>
          </>
        )}
        <input
          type="file"
          accept=".doc,.pdf,.png,.jpeg,.jpg"
          className="upload-input"
          multiple
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default UplodeImage;
