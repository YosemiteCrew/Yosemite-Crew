'use client';
import React, { useCallback, useState } from "react";
import "./AddInventory.css"
import { Button, Col, Container, Form, Row } from 'react-bootstrap'
import { Icon } from '@iconify/react/dist/iconify.js'
import { FormInput } from '../../Sign/SignUp'
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function AddInventory() {

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
        barcode: "",
        item: "",
        genric: "",


        userId: "",
        businessName: "",
        website: "",
        registrationNumber: "",
        city: "",
        state: "",
        area: "", 
        addressLine1: "",
        latitude: "",
        longitude:"",
        postalCode: "",
        phoneNumber: ""
    });
    const handleBusinessInformation = useCallback((e: { target: { name: string; value: string; }; }) => {
        const { name, value } = e.target;
        setName((prevData) => ({
          ...prevData,
          [name]: value,
        }));
    }, []);



  return (
    <>
        <section className='AddInventorySec'>
            <Container>
                <div className="InventoryData">

                    <div className="AddInventoryHead">
                        <h2>Add Inventory</h2>
                        <div className="InventrySearch">
                            <Icon icon="carbon:search" width="24" height="24" />
                            <Form.Control type="search" placeholder="Search Inventory Name"/>
                        </div>
                    </div>

                    <div className="AddInventryForm">
                        <Form>

                            <Row>
                                <Col md={6}>
                                    <FormInput intype="number" inname="barcode" value={name.barcode} inlabel="Bar Code" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Select Category"/>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="Item Name" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={6}>
                                    <FormInput intype="text" inname="genric" value={name.genric} inlabel="Generic Name" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Department"/>
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Sex Type"/>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Manufacturer"/>
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Item Category (like Tablet, Syrup, etc)"/>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Species Specific 1"/>
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Species Specific 2"/>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="On Hand"/>
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="$ Per Qty Price"/>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="Batch Number" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="SKU" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="Strength (ex: 500mg)" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="Item Name" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>

                            <Row>
                                <Col md={3}>
                                    <FormInput intype="number" inname="item" value={name.item} inlabel="$ Manufacturer Price" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="% Markup" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="UPC" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={3}>
                                    <FormInput intype="number" inname="item" value={name.item} inlabel="$ Price" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>

                            <Row>
                                <Col md={6}>
                                    <FormInput intype="number" inname="item" value={name.item} inlabel="Stock Reorder Level" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={6}>
                                    <FormInput intype="text" inname="item" value={name.item} inlabel="% Markup" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>

                        </Form>
                    </div>

                    <div className="InventryBtn">
                        <Button><Icon icon="carbon:checkmark-filled" width="24" height="24" /> Add Inventory</Button>
                    </div>

                </div>
            </Container>
        </section>
    </>
  )
}

export default AddInventory