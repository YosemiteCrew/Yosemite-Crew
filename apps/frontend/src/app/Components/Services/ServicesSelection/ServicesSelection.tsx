'use client';
import React, { useState, useMemo } from 'react';
import './ServicesSelection.css';

interface Service {
  code: string;
  display: string;
}

interface ServicesSelectionProps {
  services: Service[];
  Title: string;
  onSelectionChange: (selectedServices: string[]) => void;
}

const ServicesSelection: React.FC<ServicesSelectionProps> = ({ services, onSelectionChange , Title }) => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allServiceCodes = services.map(service => service.code);
      setSelectedServices(allServiceCodes);
      onSelectionChange(allServiceCodes);
    } else {
      setSelectedServices([]);
      onSelectionChange([]);
    }
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const serviceCode = e.target.value;
    let newSelectedServices;
    if (e.target.checked) {
      newSelectedServices = [...selectedServices, serviceCode];
    } else {
      newSelectedServices = selectedServices.filter(code => code !== serviceCode);
    }
    setSelectedServices(newSelectedServices);
    onSelectionChange(newSelectedServices);
  };

  const allSelected = useMemo(() => services.length > 0 && selectedServices.length === services.length, [services.length, selectedServices.length]);

  return (
    <div className="DepartServices">
        <div className="services_dropdown">
            <div className="services-header">
                <h6>{Title}</h6>
                <div className="select-all-container">
                    <input type="checkbox" id="select-all" onChange={handleSelectAll} checked={allSelected} />
                    <label htmlFor="select-all">Select All</label>
                </div>
            </div>
            <ul className="services-list">
                {services.map(service => (
                <li key={service.code} className={`service-item ${selectedServices.includes(service.code) ? 'selected' : ''}`}>
                    <label htmlFor={service.code}>
                        <p>{service.display}</p>
                        <input
                            type="checkbox"
                            id={service.code}
                            value={service.code}
                            onChange={handleServiceChange}
                            checked={selectedServices.includes(service.code)}
                        />
                    </label>
                </li>
                ))}
            </ul>
        </div>
    </div>
  );
};

export default ServicesSelection;