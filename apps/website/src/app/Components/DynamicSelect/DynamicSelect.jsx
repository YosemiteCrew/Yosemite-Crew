
import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import './DynamicSelect.css';

const DynamicSelect = ({ options, placeholder, value, onChange, inname }) => {
  return (
    <div className="SelectedInpt"
    style={{
      "--background-image": `url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/selctarrow.png)`
    }}
    >
      <Form.Select
        aria-label="Dynamic select menu"
        name={inname}
        value={value} // Bind the value to the state
        onChange={(e) => onChange(e.target.value)} // Pass the selected value back to the parent
      >
        <option value="">{placeholder}</option>
        {options && options.length > 0 ? (
          options.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="" disabled>
            No options available
          </option>
        )}
      </Form.Select>
    </div>
  );
};

DynamicSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  placeholder: PropTypes.string, // New prop for dynamic placeholder text
  value: PropTypes.string.isRequired, // Bind to a specific value
  onChange: PropTypes.func.isRequired, // Handle the change event
  inname: PropTypes.string.isRequired, // Name of the select element
};

DynamicSelect.defaultProps = {
  placeholder: 'Select an option', // Default placeholder
};

export default DynamicSelect;
