
'use client';
import React, { useState } from 'react';
import "./ImageGallery.css"
import { IoIosAddCircle } from 'react-icons/io';
import Image from 'next/image';
import { Button } from 'react-bootstrap';
import { RxCrossCircled } from 'react-icons/rx';

const ImageGallery = () => {
  const initialImages = [
    { id: 1, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery1.png`, alt: 'Placeholder Image 1' },
    { id: 2, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery2.png`, alt: 'Placeholder Image 2' },
    { id: 3, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery3.png`, alt: 'Placeholder Image 3' },
    { id: 4, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery4.png`, alt: 'Placeholder Image 4' },
    { id: 5, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery5.png`, alt: 'Placeholder Image 5' },
    { id: 6, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery6.png`, alt: 'Placeholder Image 6' },
    { id: 7, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery7.png`, alt: 'Placeholder Image 7' },
    { id: 8, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery8.png`, alt: 'Placeholder Image 8' },
    { id: 9, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery9.png`, alt: 'Placeholder Image 9' },
    { id: 10, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery1.png`, alt: 'Placeholder Image 10' },
    { id: 11, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery2.png`, alt: 'Placeholder Image 11' },
    { id: 12, src: `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/gallery3.png`, alt: 'Placeholder Image 12' },
  ];
  

  const [images, setImages] = useState(initialImages); // State to hold images
  const [visibleCount, setVisibleCount] = useState(9); // Initially show 9 images
  const [showMore, setShowMore] = useState(false); // State to track if more images are shown

  // Function to delete an image by ID
  const handleDelete = (id: any) => {
    setImages(images.filter((image) => image.id !== id));
  };

  // Function to handle file selection and automatically add the image
  const handleFileChange = (e: any) => {
    const file = e.target.files[0]; // Get the selected file
    if (file) {
      const newId = images.length ? images[images.length - 1].id + 1 : 1; // Incremental ID for new images
      const reader = new FileReader();
      reader.onload = () => {
        setImages([
          ...images,
          { id: newId, src: reader.result as string, alt: `Image ${newId}` },
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
        <h5>Images <span>({images.length})</span> </h5>
        <label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <IoIosAddCircle /> Add
        </label>
      </div>
      <div className="galleryimg-grid">
        {images.slice(0, visibleCount).map((image) => (
          <div className="glimage-container" key={image.id}>
            <Image aria-hidden  src={image.src} alt={image.alt} width={130} height={130} />
            
        
            
            <Button
              className="delete-button"
              onClick={() => handleDelete(image.id)}
            >
              <RxCrossCircled />
            </Button>
          </div>
        ))}
      </div>
      {images.length > 9 && (
        <Button className="glmore" onClick={handleToggleShowMore}>
          {showMore ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </div>
  );
};

export default ImageGallery;
