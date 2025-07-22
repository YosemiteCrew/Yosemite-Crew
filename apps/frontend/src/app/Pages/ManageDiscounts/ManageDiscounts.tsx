"use client";
import React, {  useState } from "react";
import './ManageDiscounts.css'
import { Button, Col, Container, Row } from 'react-bootstrap'
import Link from 'next/link'
import { Icon } from '@iconify/react/dist/iconify.js'
import ManageDiscountTable from '@/app/Components/DataTable/ManageDiscountTable'
import { HeadText } from "../CompleteProfile/CompleteProfile";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";


function ManageDiscounts() {
    const [discountLead, setDiscountLead] = useState(false);
    const [codename, setCodeName] = useState("")
    const [country, setCountry] = useState<string>("");
    type Option = {
        value: string;
        label: string;
    };
    const options: Option[] = [
        { value: 'us', label: 'Percentage' },
        { value: 'in', label: 'Fixed amount' },
    ];

    const [name, setName] = useState({
        dateOfBirth: "",    
      });

     // Use this handler for date picker:
        const handleDateChange = (date: string | null) => {
            setName((prevData) => ({
            ...prevData,
            dateOfBirth: date || "",
            }));
        };

  return (
    <>
        <section className='ManageDiscountSec'>
            <Container>
                {!discountLead ? (
                    <div className="ManageDiscountData">
                        <div className="ManageTopBar">
                            <h2>Manage Discounts</h2>
                            <Link href="" onClick={() => setDiscountLead(true)}><Icon icon="solar:add-circle-bold" width="20" height="20" /> Request New Coupons</Link>
                        </div>
                        <ManageDiscountTable/>
                    </div>
                ) : (
                    <div className="AddDiscountData">
                        <div className="DicountInner">
                            <HeadText blktext="Add" Spntext="New Discount Code" />
                            <div className="DiscountForm">
                                <Row>
                                    <Col md={12}>
                                        <FormInput intype="text" inname="codename" value={codename} inlabel="Discount Code Name" onChange={(e) => setCodeName(e.target.value)} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <FormInput intype="text" inname="codename" value={codename} inlabel="Discount Code" onChange={(e) => setCodeName(e.target.value)} />
                                    </Col>
                                    <Col md={6}>
                                        <DynamicSelect
                                            options={options}
                                            value={country}
                                            onChange={setCountry}
                                            inname="country"
                                            placeholder="Select Services"
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <DynamicSelect
                                            options={options}
                                            value={country}
                                            onChange={setCountry}
                                            inname="country"
                                            placeholder="Coupon Type"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <FormInput intype="number" inname="codename" value={codename} inlabel="Percentage Rate (%)" onChange={(e) => setCodeName(e.target.value)} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <FormInput intype="number" inname="codename" value={codename} inlabel="Min Order Value" onChange={(e) => setCodeName(e.target.value)} />
                                    </Col>
                                    <Col md={6}>
                                        <DynamicDatePicker
                                            placeholder="Valid Till"
                                            value={name.dateOfBirth}
                                            onDateChange={handleDateChange}
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={12}>
                                        <FormInput intype="text" inname="codename" value={codename} inlabel="Offer Description. Eg - 20% OFF on Grooming Services" onChange={(e) => setCodeName(e.target.value)} />
                                    </Col>
                                </Row>
                            </div>
                        </div>
                        <div className="Discountupdtbtn">
                            <Button><Icon icon="lets-icons:check-fill" width="32" height="32" /> Add Discount Code</Button>
                        </div>
                    </div>
                )}   
            </Container>
        </section>
    </>
  )
}

export default ManageDiscounts