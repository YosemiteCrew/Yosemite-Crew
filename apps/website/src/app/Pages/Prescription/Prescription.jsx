
import React, { useState } from 'react';
import "./Prescription.css";
import { AddSerchHead } from '../Add_Doctor/Add_Doctor';
import { SelectForm } from '../Add_Prescription/Add_Prescription';
import ActionsTable from '../../Components/ActionsTable/ActionsTable';
// import Accpt from "../../../../public/Images/acpt.png";
// import Decln from "../../../../public/Images/decline.png";

const Prescription = () => {
  // State to store the options for the select dropdowns
  const [options1] = useState([
    { value: "1", label: "Dr. Emily Johnson" },
    { value: "2", label: "Dr. David Brown" },
    { value: "3", label: "Dr. Megan Clark" },
  ]);
  const [options2] = useState([
    { value: "1", label: "Max" },
    { value: "2", label: "Rocky" },
    { value: "3", label: "Luna" },
  ]);

  // Separate state for each dropdown
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedPetType, setSelectedPetType] = useState("");

  // Handler for when an option is selected in the doctor dropdown
  const handleDoctorChange = (event) => {
    setSelectedDoctor(event.target.value);
  };

  // Handler for when an option is selected in the pet type dropdown
  const handlePetTypeChange = (event) => {
    setSelectedPetType(event.target.value);
  };

  return (
    <section className='PrescriptionSec'>
      <div className="container">
        <div className="MainDash">

          <AddSerchHead adtext="Prescription Management" adbtntext="Add Prescription" adhrf="/Addprescription" />
          <div className="prepstopt">
            {/* Select dropdown for doctors */}
            <SelectForm 
              selectedOption={selectedDoctor} 
              handleSelectChange={handleDoctorChange} 
              options={options1} 
              optlabel="Select Doctor" 
            />
            {/* Select dropdown for pet types */}
            <SelectForm 
              selectedOption={selectedPetType} 
              handleSelectChange={handlePetTypeChange} 
              options={options2} 
              optlabel="Pet Type" 
            />
          </div>

          <div className="Prestable">
            <ActionsTable actimg1={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Homepage/acpt.png`} actimg2={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Homepage/MainLanding/decline.png`} />
          </div>













        </div>
      </div>
    </section>
  );
}

export default Prescription;
