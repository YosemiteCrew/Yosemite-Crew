"use client";
import React, { useState} from "react";
import "./CreateAppointment.css"
import { Col, Container, Form, Row } from 'react-bootstrap'
import { FillBtn } from '../../HomePage/HomePage'
import { Icon } from '@iconify/react/dist/iconify.js'
import { FormInput } from '../../Sign/SignUp'
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function CreateAppointment() {

    const [email, setEmail] = useState("")
    const [country, setCountry] = useState<string>("");
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
                            <div className="InventrySearch">
                                <Icon icon="carbon:search" width="24" height="24" />
                                <Form.Control type="search" placeholder="Search Inventory Name"/>
                            </div>
                        </div>

                        <Row>
                            <Col>
                                <FormInput readonly={false} intype="email" inname="email" value={email} inlabel="First Name"  onChange={(e) => setEmail(e.target.value)}/>
                            </Col>
                            <Col>
                                <FormInput readonly={false} intype="email" inname="email" value={email} inlabel="Parent Name"  onChange={(e) => setEmail(e.target.value)}/>
                            </Col>
                        </Row>

                        <Row>
                            <Col>
                                <FormInput readonly={false} intype="text" inname="email" value={email} inlabel="Passport "  onChange={(e) => setEmail(e.target.value)}/>
                            </Col>
                            <Col>
                                <FormInput readonly={false} intype="email" inname="email" value={email} inlabel="Microchip Number"  onChange={(e) => setEmail(e.target.value)}/>
                            </Col>
                        </Row>
                        
                    </div>

                    <div className="CreatePetCard">

                        <div className="AddInventoryHead">
                            <h4>Appointment Details</h4>
                        </div>

                        <Row>
                            <Col>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Purpose of Visit"/>
                            </Col>
                            <Col>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Appointment Type"/>
                            </Col>
                        </Row>

                        <Row>
                            <Col>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Department"/>
                            </Col>
                            <Col>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Select Veterinarian"/>
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
                                {businessTypes.map(({key,value}) => (
                                    <li key={key}  className={`business-button ${selectedType === key ? "selected" : ""}`}
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
