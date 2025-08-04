'use client';
import React, {  useCallback,useState } from "react";
import "./ProcedurePackage.css"
import AddItemsTable from '@/app/Components/DataTable/AddItemsTable'
import { Col, Container, Row } from 'react-bootstrap'
import { FormInput } from '../../Sign/SignUp'
import DynamicSelect from '@/app/Components/DynamicSelect/DynamicSelect'

function ProcedurePackage() {

    const [name, setName] = useState({
        barcode: "",
    });
    const handleBusinessInformation = useCallback((e: { target: { name: string; value: string; }; }) => {
            const { name, value } = e.target;
            setName((prevData) => ({
              ...prevData,
              [name]: value,
            }));
        }, []);
    
    const [country, setCountry] = useState<string>("");

    const [professionalBackground, setProfessionalBackground] = useState<{ biography: string }>({
        biography: "",
    });

        type Option = {
            value: string;
            label: string;
        };
        const options: Option[] = [
            { value: 'us', label: '🇺🇸 United States' },
            { value: 'in', label: '🇮🇳 India' },
            { value: 'uk', label: '🇬🇧 United Kingdom' },
        ];
    


  return (
    <>
        <section className='ProcedurePackageSec'>
            <Container>
                <div className="ProcedurePackageData">
                    <h2>Add Procedure Package</h2>
                    <div className="ProsPackageCard">
                        
                        <div className="PackageForm">
                            <Row>
                                <Col md={6}>
                                    <FormInput intype="number" inname="barcode" value={name.barcode} inlabel="Package Name" onChange={handleBusinessInformation} />
                                </Col>
                                <Col md={6}>
                                    <DynamicSelect options={options} value={country} onChange={setCountry} inname="Category" placeholder="Select Category"/>
                                </Col>
                            </Row>
                            <Row>
                                <Col md={12}>
                                    <div className="form-floating ">
                                        <textarea
                                            className="form-control"
                                            placeholder="Short description of the procedure."
                                            id="floatingTextarea2"
                                            value={professionalBackground.biography}
                                            onChange={(e) =>
                                            setProfessionalBackground({
                                                ...professionalBackground,
                                                biography: e.target.value,
                                            })
                                            }

                                        ></textarea>
                                        <label htmlFor="floatingTextarea2">
                                            Short description of the procedure.
                                        </label>
                                    </div>
                                </Col>
                            </Row>
                        </div>


                        <hr />

                        <div className="ProcPackTble">
                            <h6>Package Items <span>(6)</span></h6>
                            <AddItemsTable />
                        </div>

                    </div>

                </div>
            </Container>
        </section>
      
    </>
  )
}

export default ProcedurePackage
