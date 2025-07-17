import React from 'react';
import { Form } from 'react-bootstrap';
import './DynamicSelect.css';

export type Option = { value: string; label: string };

interface DynamicSelectProps {
  options: Option[];
  placeholder?: string;
  value: string; // string only
  onChange: (value: string) => void;
  inname: string;
  error?: string;
}

const DynamicSelect: React.FC<DynamicSelectProps> = ({
  options,
  placeholder = 'Select an option',
  value,
  onChange,
  inname,
  error,
}) => {
  const isValueInOptions = options.some((opt) => opt.value === value);

  return (
    <div className='w-100'>
      <div
        className="SelectedInpt"
        style={{
          backgroundImage: `url(${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/selctarrow.png)`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 20px center",
          backgroundSize: '28px',
        }}
      >
        <Form.Select
          aria-label="Dynamic select menu"
          name={inname}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          isInvalid={!!error}
        >
          <option value="">{placeholder}</option>

          {/* If value is not in options, add it temporarily */}
          {!isValueInOptions && value && (
            <option value={value}>{value}</option>
          )}

          {options.length > 0 ? (
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
      {error && <Form.Text className="text-danger">{error}</Form.Text>}
    </div>
  );
};

export default DynamicSelect;
