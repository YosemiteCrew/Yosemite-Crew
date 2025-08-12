"use client";
import React, { useState } from "react";
import { Col, Container, Form, Row } from 'react-bootstrap'
import "./AddPatient.css"
import { UnFillBtn } from '../../HomePage/HomePage'
import { Icon } from '@iconify/react/dist/iconify.js'
import { FormInput } from '../../Sign/SignUp'
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function AddPatient() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState({
        dateOfBirth: "",
        gender: "",
        breder: "",
    });
    // Use this handler for date picker:
    const handleDateChange = (date: string | null) => {
        setName((prevData) => ({
        ...prevData,
        dateOfBirth: date || "",
        }));
    };
    // Gender 
    const handleGenderClick = (gender: string) => {
        setName((prevData) => ({
        ...prevData,
        gender,
        }));
    };
    // Gender 
    //Specialization Options
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
    // Gender 
    const handleBreadClick = (breder: string) => {
        setName((prevData) => ({
        ...prevData,
        breder,
        }));
    };
    // Gender 


  return (
    <>
    <section className='AddPatientSec'>
        <Container>
            <div className="PatientData">

                <div className="PatientHead">
                    <h2>Add New patient</h2>
                    <UnFillBtn href="#" icon={<Icon icon="solar:add-circle-bold" width="24" height="24" />} text="Import Data" />
                </div>

                <div className="PatientPetDetails">
                    <Form>
                        <h6>Pet Detail</h6>
                        <Row>
                            <Col md={6}>
                                <FormInput intype="text" inname="email" value={email} inlabel="First Name" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                            <Col md={6}>
                                <FormInput intype="text" inname="email" value={email} inlabel="Last Name" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={4}>
                                <div className="FormGendr">
                                    <p>Gender</p>
                                    <ul className="SelectUl">
                                        {["Male", "Female", "Other"].map((gender) => (
                                        <li
                                            key={gender}
                                            className={name.gender === gender ? "active" : ""}
                                            onClick={() => handleGenderClick(gender)}
                                        >
                                            {gender}
                                        </li>
                                        ))}
                                    </ul>
                                </div>
                            </Col>
                            <Col md={8}>
                                <DynamicDatePicker placeholder="Date of Birth" value={name.dateOfBirth} onDateChange={handleDateChange} />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <FormInput intype="text" inname="email" value={email} inlabel="Pet Type/Breed" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                            <Col md={6}>
                                <FormInput intype="number" inname="email" value={email} inlabel="Current Weight" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={3}>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Colour" />
                            </Col>
                            <Col md={3}>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Blood Group" />
                            </Col>
                            <Col md={6}>
                                <div className="SelectTab">
                                    <ul className="SelectUl">
                                        {["Neutered", "Not Neutered", "Age when neutered"].map((breder) => (
                                        <li
                                            key={breder}
                                            className={name.breder === breder ? "active" : ""}
                                            onClick={() => handleBreadClick(breder)}
                                        >
                                            {breder}
                                        </li>
                                        ))}
                                    </ul>
                                </div>
                            </Col>
                        </Row>

                    </Form>

                </div>

                <div className="PatientPetDetails">
                    <Form>
                        <h6>Pet Documents</h6>
                        <Row>
                            <Col md={6}>
                                <FormInput intype="number" inname="email" value={email} inlabel="Microchip Number" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                            <Col md={6}>
                                <FormInput intype="number" inname="email" value={email} inlabel="Passport Number" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={3}>
                                <div className="SelectTab">
                                    <ul className="SelectUl">
                                        {["Insured", "Not Insured"].map((breder) => (
                                        <li
                                            key={breder}
                                            className={name.breder === breder ? "active" : ""}
                                            onClick={() => handleBreadClick(breder)}
                                        >
                                            {breder}
                                        </li>
                                        ))}
                                    </ul>
                                </div>
                            </Col>
                            <Col md={3}>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Insurance Company" />
                            </Col>
                            <Col md={6}>
                                <FormInput intype="number" inname="email" value={email} inlabel="Insurance Policy Number" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                        </Row>



                        <Row>
                            <Col md={6}>
                                <FormInput intype="text" inname="email" value={email} inlabel="Pet Type/Breed" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                            <Col md={6}>
                                <FormInput intype="number" inname="email" value={email} inlabel="Current Weight" onChange={(e) => setEmail(e.target.value)} />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={3}>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Colour" />
                            </Col>
                            <Col md={3}>
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Blood Group" />
                            </Col>
                            <Col md={6}>
                                <div className="SelectTab">
                                    <ul className="SelectUl">
                                        {["Neutered", "Not Neutered", "Age when neutered"].map((breder) => (
                                        <li
                                            key={breder}
                                            className={name.breder === breder ? "active" : ""}
                                            onClick={() => handleBreadClick(breder)}
                                        >
                                            {breder}
                                        </li>
                                        ))}
                                    </ul>
                                </div>
                            </Col>
                        </Row>

                    </Form>

                </div>








            </div>
        </Container>
    </section>
      
    </>
  )
}

export default AddPatient
