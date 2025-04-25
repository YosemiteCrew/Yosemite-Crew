import React, { useState, useCallback, useEffect } from 'react';
import './AddProcedurePackage.css';
import { Col, Container, Form, Row } from 'react-bootstrap';
import { Forminput } from '../SignUp/SignUp';
import DynamicSelect from '../../Components/DynamicSelect/DynamicSelect';
import PackageTable from '../../Components/PackageTable/PackageTable';
import { MainBtn } from '../Appointment/page';
// import whtcheck from '../../../../public/Images/whtcheck.png';
import axios from 'axios';
import { useAuth } from '../../context/useAuth';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import {  InventoryFHIRParser, MedicalPackageFHIR } from '../../utils/InventoryFHIRMapper';

function AddProcedurePackage() {
  const { userId,onLogout } = useAuth();
  const navigate = useNavigate()

  const [procedureData, setProcedureData] = useState({
    packageName: '',
    category: '',
    description: '',
    packageItems: [],
  });

  const [options, setOptions] = useState([])


const procedurePackageCatories = useCallback(async()=> {
  try {
    const response = await axios.get(`${import.meta.env.VITE_BASE_URL}fhir/admin/procedureCategory?bussinessId=${userId}`);
    if(response.status === 200) {

      const res = new InventoryFHIRParser(response.data.data).convertToNormaldata();

      setOptions(res)
    }
  } catch (error) {
    console.log(error);
  if(error.response.status === 400 || error.response.status === 500) {
    Swal.fire({
      type:"error",
      text: `${error.response.data.issue[0].details.text}`,
      icon: "error",

    })
  }
  }
},[userId])

useEffect(()=>{
  if(userId){
    procedurePackageCatories()
  }
},[procedurePackageCatories,userId])



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!procedureData.packageName || !procedureData.category) {
      alert('Please fill in all required fields.');
      return;
    }
const data = new MedicalPackageFHIR(procedureData).toFHIR()

console.log("procedureData",data)
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}api/inventory/AddProcedurePackage?bussinessId=${userId}`,
        data,{headers:{Authorization:`Bearer ${token}`}}
      );
      if(response.status === 200) {
        console.log(response.data);
        Swal.fire({
          title: 'Success',
          text: `${response.data.issue[0].details.text}`,
          icon:'success',
        })
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }else if(error.response.status === 400 || error.response.status === 500)
      Swal.fire({
        title: 'Error',
        text: `${error.response.data.issue[0].details.text}`,
        icon: 'error',
      })
    }
  };

  const updatePackageItems = useCallback((items) => {
    setProcedureData((prevData) => ({
      ...prevData,
      packageItems: items,
    }));
  }, []);

  return (
    <section className="AddProcedurePackageSec">
      <Container>
        <div className="AddProcedurePackagedata">
          <div className="TopProcedHead">
            <h3>
              <span>Add</span> Procedure Package
            </h3>
          </div>

          <div className="AddProcedurePackageBox">
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Forminput
                    inlabel="Package Name"
                    intype="text"
                    inname="name"
                    onChange={(e) =>
                      setProcedureData((prevData) => ({
                        ...prevData,
                        packageName: e.target.value,
                      }))
                    }
                    value={procedureData.packageName}
                  />
                </Col>
                <Col md={6}>
                  <DynamicSelect
                    options={options}
                    onChange={(value) =>
                      setProcedureData((prevData) => ({
                        ...prevData,
                        category: value,
                      }))
                    }
                    placeholder="Category"
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <div className="form-floating mb-3">
                    <textarea
                      className="form-control"
                      placeholder="Short description of the procedure."
                      id="floatingTextarea2"
                      onChange={(e) =>
                        setProcedureData((prevData) => ({
                          ...prevData,
                          description: e.target.value,
                        }))
                      }
                      value={procedureData.description}
                    ></textarea>
                    <label htmlFor="floatingTextarea2">
                      Short description of the procedure.
                    </label>
                  </div>
                </Col>
              </Row>
              <PackageTable updatePackageItems={updatePackageItems} />
              <div className="ee">
                <MainBtn bimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/whtcheck.png`} btext="Add Package" optclas="" />
              </div>
            </Form>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default AddProcedurePackage;
