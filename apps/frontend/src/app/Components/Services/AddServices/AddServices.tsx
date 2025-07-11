import React, { useState } from 'react';
import "./AddServices.css";

const initialServices = [
  { label: "24/7 Emergency Care", checked: true },
  { label: "Surgey and Operating Rooms", checked: true },
  { label: "Veterinary ICUs", checked: false },
  { label: "Diagnostic Imaging (X-ray, Ultrasound)", checked: true },
  { label: "In-House Laboratory", checked: false },
  { label: "Dental Clinic", checked: true },
  { label: "Pain Management", checked: false },
];

function AddServices() {
  const [services, setServices] = useState(initialServices);
  const [showAll, setShowAll] = useState(false);

  const handleCheck = (idx: number) => {
    setServices(services =>
      services.map((s, i) =>
        i === idx ? { ...s, checked: !s.checked } : s
      )
    );
  };

  // Show only first 4 if not showAll
  const visibleServices = showAll ? services : services.slice(0, 4);

  return (
    <div className="add-services-card">
      <div className="add-services-header">
        <span className="add-services-title">Services</span>
        {services.length > 4 && (
          <button
            className="add-services-showall"
            type="button"
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? "Show Less" : "Show All"}
          </button>
        )}
      </div>
      <div className="add-services-list">
        {visibleServices.map((service, idx) => (
          <label className="add-services-row" key={service.label}>
            <input
              type="checkbox"
              className="form-check-input"
              checked={service.checked}
              onChange={() => handleCheck(showAll ? idx : idx)}
            />
            <span className={`add-services-label${service.checked ? " checked" : ""}`}>
              {service.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default AddServices;