import React from 'react';
import { Form } from 'react-bootstrap';
import './DynamicSelect.css';

export interface Option {
  value: string;
  label: string;
}

interface DynamicSelectProps {
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inname: string;
}

const DynamicSelect: React.FC<DynamicSelectProps> = ({
  options,
  placeholder = 'Select an option',
  value,
  onChange,
  inname,
}) => {
  return (
    <div
      className="SelectedInpt"
      style={{
        backgroundImage: `url(${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/selctarrow.png)`,
        backgroundRepeat:"no-repeat",
        backgroundPosition:"right 20px center",
        backgroundSize:'28px'
      }}>
      <Form.Select
        aria-label="Dynamic select menu"
        name={inname}
        value={value}
        onChange={(e) => onChange(e.target.value)}>
          
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

export default DynamicSelect;
