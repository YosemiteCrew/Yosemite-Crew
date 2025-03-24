
import React, { useState } from 'react'
import "./Add_Prescription.css"
import { Forminput, HeadText } from '../SignUp/SignUp'
import { DashHeadtext } from '../Doctor_Dashboard/Doctor_Dashboard'
import UplodeImage from '../../Components/UplodeImage/UplodeImage'
import PropTypes from 'prop-types';
import { MainBtn } from '../Appointment/page'
// import whtcheck from "../../../../public/Images/whtcheck.png"



const Add_Prescription = () => {

  // State to store the options for the select dropdown
  const [options] = useState([
    { value: "1", label: "Dr. Emily Johnson" },
    { value: "2", label: "Dr. David Brown" },
    { value: "3", label: "Dr. Megan Clark" },
  ]);

  const [selectedOption, setSelectedOption] = useState("");

  // Handler for when an option is selected
  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
  };



  return (


    <section className='PrescripSec'>
        <div className="container">

            <div className="mb-3">
              <HeadText Spntext="Add" blktext="a Prescription"/>
            </div>

            <div className="Prescrip_Data">

                <div className="PresDetails">
                    <DashHeadtext htxt="Details" />
                    <div className="">
                        <Forminput inlabel="Appointment ID" intype="number" inname="number"/>
                        <Forminput inlabel="Prescription Date" intype="date" inname="date"/>
                        <SelectForm selectedOption={selectedOption} handleSelectChange={handleSelectChange} options={options} optlabel="Doctor’s Name"/>
                        <div className="prediv">
                            <Forminput inlabel="Pet’s Name" intype="text" inname="text"/>
                            <Forminput inlabel="Age" intype="number" inname="number"/>
                        </div>
                        <div className="prediv">
                            <Forminput inlabel="Pet’s Weight" intype="number" inname="number"/>
                            <Forminput inlabel="Temperature" intype="number" inname="number"/>
                        </div>
                        <div className="prediv">
                            <Forminput inlabel="Blood Pressure" intype="text" inname="text"/>
                            <Forminput inlabel="SPO2" intype="text" inname="text"/>
                        </div>
                        <Forminput inlabel="Heart Rate" intype="text" inname="text"/>    
                    </div>               
                </div>

                <div className="PresNotes">
                    <DashHeadtext htxt="Prescription Notes " />
                    <div className="">
                        <FormArea lablarea="Subjective" areaplace='Add details' Arearow="2" formcls="mb-3"/>
                        <FormArea lablarea="Objective" areaplace='Add details' Arearow="2" formcls="mb-3"/>
                        <FormArea lablarea="Assessment" areaplace='Add details' Arearow="2" formcls="mb-3"/>
                        <FormArea lablarea="Plan" areaplace='Add details' Arearow="2" formcls="mb-3"/>
                        <div className="ff">
                            <h6>OR Upload</h6>
                            <UplodeImage/>
                        </div>
                    </div>
                </div>

            </div>

            <div className="presbtn" >
                <MainBtn bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`} btext="Sign up"  />
            </div>
            

           
        </div>
    </section>
    
    
    
    
  
  )
}

export default Add_Prescription



SelectForm.propTypes = {
    selectedOption: PropTypes.string.isRequired,
    handleSelectChange: PropTypes.func.isRequired, 
    optlabel: PropTypes.func.isRequired, 
    options: PropTypes.arrayOf(PropTypes.shape({ 
        value: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
    })).isRequired,
};
export function SelectForm({ selectedOption, handleSelectChange, options ,optlabel }) {
    return (
        <div className='FormSelect mb-3'>
            <select
                aria-label="Dynamic select example"
                value={selectedOption}
                onChange={handleSelectChange}>
                <option value="" disabled>
                    {optlabel}
                    
                </option>
                {options.map((option, index) => (
                    <option key={index} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

FormArea.propTypes = {
    lablarea: PropTypes.string.isRequired, 
    areaplace: PropTypes.string.isRequired,                
    Arearow: PropTypes.string.isRequired,                
    formcls: PropTypes.string.isRequired,                
};
export function FormArea({lablarea , areaplace , Arearow ,formcls}) {
    return <div className={`Formarea ${formcls}`}>
        <label htmlFor="exampleFormControlTextarea1" className="form-label">{lablarea}</label>
        <textarea className="form-control" id="exampleFormControlTextarea1" placeholder={areaplace} rows={Arearow}></textarea>
    </div>
}
