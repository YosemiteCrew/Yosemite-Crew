
import React, { useEffect } from 'react';
import './Glightbox.css';
import PropTypes from 'prop-types';
import GLightbox from 'glightbox';
import 'glightbox/dist/css/glightbox.css';

const Glightbox = ({ videoLink, buttonColor, buttonBackground }) => {
  useEffect(() => {
    const lightbox = GLightbox({
      selector: '.glightbox-link',
    });

    return () => {
      lightbox.destroy();
    };
  }, []);

  return (

      <a
        href={videoLink}
        className="glightbox-link pulsating-play-btn"
        style={{
          '--btn-color': buttonColor,
          '--btn-background': buttonBackground,
        }}
      >..</a>
 
  );
};

// Add PropTypes validation
Glightbox.propTypes = {
  videoLink: PropTypes.string.isRequired,
  buttonColor: PropTypes.string,
  buttonBackground: PropTypes.string,
};

export default Glightbox;
