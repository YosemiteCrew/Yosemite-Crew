// PhoneInput.tsx
import React from "react";
import "./PhoneInput.css";
import { Form } from "react-bootstrap";
import { FaChevronDown } from "react-icons/fa6";

interface CountryOption {
  code: string;
  flag: string;
  label: string;
}

interface PhoneInputProps {
  countryCode: string;
  onCountryCodeChange?: (code: string) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  countryOptions?: CountryOption[];
  error?: string;
}

const defaultCountries: CountryOption[] = [
  { code: "+1", flag: "🇺🇸", label: "United States" },
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+81", flag: "🇯🇵", label: "Japan" },
];

export const PhoneInput: React.FC<PhoneInputProps> = ({
  countryCode,
  onCountryCodeChange,
  phone,
  onPhoneChange,
  countryOptions = defaultCountries,
  error,
}) => {
  const selectedCountry =
    countryOptions.find((c) => c.code === countryCode) || countryOptions[0];

  return (
    <Form.Group className="mb-3">
      <Form.Label>Phone Number</Form.Label>
      <div className={`custom-phone-input ${error ? "is-invalid" : ""}`}>
        <div className="country-select">
          <span
            className="flag"
            style={{
              minWidth: 28,
              textAlign: "center",
              fontSize: 22,
              display: "inline-block",
            }}
          > 
          </span>
          <select
            value={countryCode}
            onChange={(e) => onCountryCodeChange?.(e.target.value)}
            className={`country-dropdown ${error ? "is-invalid" : ""}`}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
              padding: "0 18px 0 0",
              appearance: "none",
              minWidth: 48,
              marginLeft: 4,
            }}
          >
            {countryOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.flag} {opt.code}
              </option>
            ))}
          </select>
          <FaChevronDown className="chevron" />
        </div>
        <input
          className={`phone-input ${error ? "is-invalid" : ""}`}
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="672-892-6294"
          maxLength={15}
          style={{
            border: "none",
            outline: "none",
            fontSize: 20,
            fontWeight: 500,
            color: "#444",
            background: "transparent",
            padding: "12px 18px",
            flex: 1,
            borderRadius: "999px",
          }}
        />
      </div>
      {error && <Form.Text className="text-danger">{error}</Form.Text>}
    </Form.Group>
  );
};