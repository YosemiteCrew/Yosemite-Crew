// eslint-disable-next-line no-unused-vars
import React, { useState } from 'react';
import './Gallery.css';
import gallery1 from '../../../../public/Images/gallery1.png';
import gallery2 from '../../../../public/Images/gallery2.png';
import gallery3 from '../../../../public/Images/gallery3.png';
import gallery4 from '../../../../public/Images/gallery4.png';
import gallery5 from '../../../../public/Images/gallery5.png';
import gallery6 from '../../../../public/Images/gallery6.png';
import gallery7 from '../../../../public/Images/gallery7.png';
import gallery8 from '../../../../public/Images/gallery8.png';
import gallery9 from '../../../../public/Images/gallery9.png';

const Gallery = () => {
  const initialImages = [
    { id: 1, src: gallery1, alt: 'Placeholder Image 1' },
    { id: 2, src: gallery2, alt: 'Placeholder Image 2' },
    { id: 3, src: gallery3, alt: 'Placeholder Image 3' },
    { id: 4, src: gallery4, alt: 'Placeholder Image 4' },
    { id: 5, src: gallery5, alt: 'Placeholder Image 5' },
    { id: 6, src: gallery6, alt: 'Placeholder Image 6' },
    { id: 7, src: gallery7, alt: 'Placeholder Image 7' },
    { id: 8, src: gallery8, alt: 'Placeholder Image 8' },
    { id: 9, src: gallery9, alt: 'Placeholder Image 9' },
    { id: 10, src: gallery1, alt: 'Placeholder Image 10' },
    { id: 11, src: gallery2, alt: 'Placeholder Image 11' },
    { id: 12, src: gallery3, alt: 'Placeholder Image 12' },
  ]; // Placeholder images

  const [images, setImages] = useState(initialImages); // State to hold images
  const [visibleCount, setVisibleCount] = useState(9); // Initially show 9 images
  const [showMore, setShowMore] = useState(false); // State to track if more images are shown

  // Function to delete an image by ID
  const handleDelete = (id) => {
    setImages(images.filter((image) => image.id !== id));
  };

  // Function to handle file selection and automatically add the image
  const handleFileChange = (e) => {
    const file = e.target.files[0]; // Get the selected file
    if (file) {
      const newId = images.length ? images[images.length - 1].id + 1 : 1; // Incremental ID for new images
      const reader = new FileReader();
      reader.onload = () => {
        setImages([
          ...images,
          { id: newId, src: reader.result, alt: `Image ${newId}` },
        ]);
      };
      reader.readAsDataURL(file); // Read the image as a data URL
    }
  };

  // Function to toggle show more/less images
  const handleToggleShowMore = () => {
    setShowMore((prevShowMore) => !prevShowMore); // Toggle the showMore state
    setVisibleCount((prevCount) => (prevCount === 9 ? images.length : 9)); // Show all or reset to 9
  };

  return (
    <div className="galleryDiv">
      <div className="GalryTopdetl">
        <h5>
          Images <span>({images.length})</span>
        </h5>
        <label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <i className="ri-add-circle-fill"></i> Add
        </label>
      </div>
      <div className="galleryimg-grid">
        {images.slice(0, visibleCount).map((image) => (
          <div className="glimage-container" key={image.id}>
            <img
              type="text/html"
              src={image.src}
              alt={image.alt}
              className="image"
            />

        
            
            <button
              className="delete-button"
              onClick={() => handleDelete(image.id)}
            >
              <i className="ri-close-circle-line"></i>
            </button>
          </div>
        ))}
      </div>
      {images.length > 9 && (
        <button className="glmore" onClick={handleToggleShowMore}>
          {showMore ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
};

export default Gallery;
