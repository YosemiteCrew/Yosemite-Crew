"use client";
import React, { useCallback, useState, useRef } from "react";
import "./CreateAppointment.css"
import { Col, Container, Form, Row } from 'react-bootstrap'
import { FillBtn } from '../../HomePage/HomePage'
import { Icon } from '@iconify/react/dist/iconify.js'
import { FormInput } from '../../Sign/SignUp'
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { getData } from "@/app/axios-services/services";
import { convertFhirToNormalPetData } from "@yosemite-crew/fhir";
import { NormalPetData } from "@yosemite-crew/types";
import Image from "next/image";

function CreateAppointment() {
    const [petDetails, setPetDetails] = useState<any>({
        petName:"",
        parentName:"",
        passportNumber:"",
        microChipNumber:"",
        purposeOfVisit:"",
        appointmentType:"",
        department:"",
        doctor:"",
        appointmentDate:"",
        appointmentSlot:""
    })
    const [country, setCountry] = useState<string>("");
    const [searchData, setSearchData] = useState<NormalPetData[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    console.log("searchData",searchData)
    type Option = {
        value: string;
        label: string;
    };
    const options: Option[] = [
        { value: 'us', label: '🇺🇸 United States' },
        { value: 'in', label: '🇮🇳 India' },
        { value: 'uk', label: '🇬🇧 United Kingdom' },
    ];

    const [name, setName] = useState({
        dateOfBirth: "",
    });
    
    const handleData = (data:any)=>{
     setPetDetails((pre:any)=>({
        ...pre,
       [data.name]:data.value
     }))
    }

    const handleDateChange = (date: string | null) => {
        setName((prevData) => ({
            ...prevData,
            dateOfBirth: date || "",
        }));
    };
    const businessTypes = [
        { key: "10:30 AM", value: "10:30 AM" },
        { key: "10:45 AM", value: "10:45 AM" },
        { key: "11:00 AM", value: "11:00 AM" },
        { key: "11:15 AM", value: "11:15 AM" },
        { key: "11:30 AM", value: "11:30 AM" },
        { key: "11:45 AM", value: "11:45 AM" },
        { key: "12:00 PM", value: "12:00 PM" },
        { key: "12:15 PM", value: "12:15 PM" },
        { key: "12:30 PM", value: "12:30 PM" },
        { key: "2:30 PM", value: "2:30 PM" },
        { key: "3:15 PM", value: "3:15 PM" },
        { key: "3:45 PM", value: "3:45 PM" },
        { key: "4:30 PM", value: "4:30 PM" },
        { key: "5:15 PM", value: "5:15 PM" },
    ];
    const [selectedType, setSelectedType] = useState<string>("");
    const handleSelectType = (type: React.SetStateAction<string>) => {
        setSelectedType(type);
    };

    const searchPets = useCallback(async (value: any) => {
        let names = "";
        let microChip = "";

        // Check: value has both letters and digits (microchip)
        const isMicrochip = /[a-zA-Z]/.test(value) && /\d/.test(value);

        if (isMicrochip) {
            microChip = value;
        } else {
            names = value;
        }

        try {
            const response = await getData(`/api/appointments/pets?names=${names}&microChip=${microChip}`);
            const data:any = response.data
            const petData = convertFhirToNormalPetData(data.data);
            setSearchData(petData);
            setShowDropdown(petData.length > 0);
            console.log(data.data); // optional
        } catch (error) {
            console.error(error);
            setSearchData([]);
            setShowDropdown(false);
        }
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);
        searchPets(value);
    };

    const handlePetSelect = (pet: NormalPetData) => {
        setSearchValue(`${pet.petName} - ${pet.petParentName}`);
        setPetDetails((prev:any) => ({
        ...prev,
        petName: pet.petName || "",
        parentName: pet.petParentName || "",
        passportNumber: pet.passportNumber || "",               // if available
        microChipNumber: pet.microChipNumber || "", // assuming this field exists
    }));

        setShowDropdown(false);
    };

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
        }
    };

    React.useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <>
            <section className='CreateAppointmentSec'>
                <Container>
                    <div className="CreateAppointmentData">
                        <h2>Create Appointment</h2>

                        <div className="CreateAppointCard">
                            <div className="CreatePetCard">
                                <div className="AddInventoryHead">
                                    <h6>Pet Detail</h6>
                                    <div className="InventrySearch" ref={dropdownRef}>
                                        <Icon icon="carbon:search" width="24" height="24" />
                                        <Form.Control 
                                            type="text" 
                                            placeholder="Search Pet name, Microchip Number or Parent Name." 
                                            value={searchValue}
                                            onChange={handleSearchChange}
                                            onFocus={() => searchData.length > 0 && setShowDropdown(true)}
                                        />
                                        {showDropdown && searchData.length > 0 && (
                                            <div className="search-dropdown">
                                                {searchData.map((pet, index) => (
                                                    <div 
                                                        key={index} 
                                                        className="dropdown-item"
                                                        onClick={() => handlePetSelect(pet)}
                                                    >   
                                                         <Image
                                                                   aria-hidden
                                                                   src={pet.petImage}
                                                                   alt="eyes"
                                                                   width={50}
                                                                   height={50}
                                                                 />
                                                        <div className="pet-name">{pet.petName}</div>
                                                        <div className="pet-owner">{pet.petParentName}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Rest of your existing code remains unchanged */}
                                <Row>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="petName" value={petDetails.petName} inlabel="Pet Name" onChange={(e) => handleData(e.target)} />
                                    </Col>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="parentName" value={petDetails.parentName} inlabel="Parent Name" onChange={(e) => handleData(e.target)}  />
                                    </Col>
                                </Row>

                                <Row>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="passportNumber" value={petDetails.passportNumber} inlabel="Passport " onChange={(e) => handleData(e.target)}  />
                                    </Col>
                                    <Col>
                                        <FormInput readonly={false} intype="text" inname="microChipNumber" value={petDetails.microChipNumber} inlabel="Microchip Number" onChange={(e) => handleData(e.target)}  />
                                    </Col>
                                </Row>
                            </div>

                            {/* Rest of your existing code remains unchanged */}
                            <div className="CreatePetCard">
                                <div className="AddInventoryHead">
                                    <h4>Appointment Details</h4>
                                </div>

                                <Row>
                                    <Col>
                                        <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Purpose of Visit" />
                                    </Col>
                                    <Col>
                                        <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Appointment Type" />
                                    </Col>
                                </Row>

                                <Row>
                                    <Col>
                                        <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Department" />
                                    </Col>
                                    <Col>
                                        <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Select Veterinarian" />
                                    </Col>
                                </Row>

                                <Row>
                                    <Col md={12}>
                                        <DynamicDatePicker
                                            placeholder="Appointment Date"
                                            value={name.dateOfBirth}
                                            onDateChange={handleDateChange}
                                        />
                                    </Col>
                                </Row>

                                <div className="ApointTime-Container">
                                    <p>Appointment Time</p>
                                    <div className="button-group">
                                        <ul>
                                            {businessTypes.map(({ key, value }) => (
                                                <li key={key} className={`business-button ${selectedType === key ? "selected" : ""}`}
                                                    onClick={() => handleSelectType(key)}>
                                                    {value}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="CreateAppint">
                                <FillBtn icon={<Icon icon="solar:add-circle-bold" width="24" height="24" />} text="Create Appointment" href="#" />
                            </div>
                        </div>
                    </div>
                </Container>
            </section>
        </>
    )
}

export default CreateAppointment