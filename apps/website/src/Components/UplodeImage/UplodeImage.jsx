import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify'; // Import DOMPurify
import './UplodeImage.css';

const UplodeImage = ({ onFileChange, selectedFiles }) => {
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [error, setError] = useState('');

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  const handleFileChange = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    const validFiles = [];
    let errorMessage = '';

    uploadedFiles.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errorMessage = 'File size exceeds 20 MB limit.';
      } else if (!file.type.match('image.*') && !file.type.match('application/pdf') && !file.type.match('application/msword')) {
        errorMessage = 'Invalid file type. Only DOC, PDF, PNG, JPEG formats are allowed.';
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      const updatedFiles = [...files, ...validFiles];
      setFiles(updatedFiles);
      onFileChange(updatedFiles);
      setError(''); // Clear any previous error
    } else {
      setError(errorMessage);
    }
  };

  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
    }
  }, [selectedFiles]);

  useEffect(() => {
    const urls = files.map((file) => {
      if (file && file instanceof File) {
        return URL.createObjectURL(file);
      }
      return null; // Handle invalid files gracefully
    });
    setFilePreviews(urls);

    return () => {
      // Clean up blob URLs
      urls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [files]);

  // Sanitize the error message if it exists
  const sanitizedError = error ? DOMPurify.sanitize(error) : '';

  return (
    <div>
      <div className="upload-box">
        {sanitizedError && <p className="error-message" dangerouslySetInnerHTML={{ __html: sanitizedError }} />}
        {files.length > 0 ? (
          <div className="file-preview">
            {files.map((file, index) => {
              const fileType = file.type;
              const isImage = fileType.startsWith('image/');
              return (
                <div key={index} className="file-item">
                  {isImage ? (
                    <img
                      src={filePreviews[index]}
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
              <img
                src={`${import.meta.env.VITE_BASE_IMAGE_URL}/uplode.png`}
                alt="Upload Icon"
              />
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