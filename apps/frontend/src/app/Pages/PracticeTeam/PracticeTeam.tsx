'use client';
import React, { useState } from 'react';
import { Button, Form, Tab, Tabs, Container } from 'react-bootstrap';
import "./PracticeTeam.css"
import { AiFillMinusCircle } from 'react-icons/ai';
import DynamicSelect from '@/app/Components/DynamicSelect/DynamicSelect';
import { FormInput } from '../Sign/SignUp';
import { PiFileArrowDownFill } from 'react-icons/pi';
import { IoIosArrowDropleft } from 'react-icons/io';
import { FaCircleCheck } from 'react-icons/fa6';
import { IoAddCircle } from 'react-icons/io5';

function PracticeTeam() {
    const [country, setCountry] = useState<string>(''); //Set country
    const [key, setKey] = useState<'individual' | 'bulk'>('individual');
    const [bulkEmails, setBulkEmails] = useState<string[]>(['']);
    const [email, setEmail] = useState('');

    type Option = {
    value: string;
    label: string;
    };

    const options: Option[] = [
    { value: '', label: 'United States' },
    { value: '', label: 'India' },
    { value: '', label: 'United Kingdom' },
    ];


    const handleAddEmail = () => {
        setBulkEmails([...bulkEmails, '']);
    };

    const handleRemoveEmail = (index: number) => {
        const updated = [...bulkEmails];
        updated.splice(index, 1);
        setBulkEmails(updated);
    };

    const handleEmailChange = (index: number, value: string) => {
        const updated = [...bulkEmails];
        updated[index] = value;
        setBulkEmails(updated);
    };


  return (
    <>

    <section className='PracticeTeamSec'>
        <Container>
            <div className="PracticeTeamData">
                <div className="InviteContainer">

                    <div className="InviteHeader">
                        <h4>Invite <span>team member</span></h4>
                        <Button className="ImportBtn"><PiFileArrowDownFill /> Import Data</Button>
                    </div>

                    <div className="InviteCard">

                        <div className="TopTabs">
                            <p>Select Invite Type</p>
                            <Tabs activeKey={key} onSelect={(k) => setKey(k as 'individual' | 'bulk')} className=" InviteTabs">

                                <Tab eventKey="individual" title="Individual Invite">
                                    <Form>
                                        <DynamicSelect
                                            options={options}
                                            value={country}
                                            onChange={setCountry}
                                            inname="country"
                                            placeholder="Department"
                                        />
                                        <DynamicSelect
                                            options={options}
                                            value={country}
                                            onChange={setCountry}
                                            inname="country"
                                            placeholder="Select Role"
                                        />
                                    <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => setEmail(e.target.value)} />
                                    </Form>
                                </Tab>

                                <Tab eventKey="bulk" title="Bulk Invite">
                                    <Form>
                                        {bulkEmails.map((email, index) => (
                                        <div className="BulkInpt" key={index}>
                                            <FormInput intype="email" inname="email" value={email} inlabel="Email Address" onChange={(e) => handleEmailChange(index, e.target.value)} />
                                            <Button onClick={() => handleRemoveEmail(index)}><AiFillMinusCircle /></Button>
                                        </div>
                                        ))}
                                        <div className="AddMorebtn">
                                            <Button onClick={handleAddEmail}><IoAddCircle /> Add More</Button>
                                        </div>
                                        
                                    </Form>
                                </Tab>

                            </Tabs>
                        </div>

                        <div className="InviteFooter">
                            <Button className="BackBtn"><IoIosArrowDropleft /> Back</Button>
                            <Button className="SendBtn"><FaCircleCheck /> Send Invite</Button>
                        </div>

                    </div>
                </div>

            </div>
           

        </Container>
    </section>

    




    </>
  )
}

export default PracticeTeam