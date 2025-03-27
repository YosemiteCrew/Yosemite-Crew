import React, { useState, useCallback } from 'react';
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

function AddProcedurePackage() {
  const { userId,onLogout } = useAuth();
  const navigate = useNavigate()

  const [procedureData, setProcedureData] = useState({
    packageName: '',
    category: '',
    description: '',
    packageItems: [],
  });

  // console.log('procedureData', procedureData);

  const options = [
    { value: '1', label: 'Appendectomy' },
    { value: '2', label: 'Gallbladder Removal' },
    { value: '3', label: 'Knee Replacement' },
    { value: '4', label: 'Hip Replacement' },
    { value: '5', label: 'Spinal Fusion' },
    { value: '6', label: 'Angioplasty and Stent Placement' },
    { value: '7', label: 'Pacemaker Implantation' },
    { value: '8', label: 'Lobectomy' },
    { value: '9', label: 'Retinal Detachment Repair' },
    { value: '10', label: 'Breast Augmentation or Reduction' },
    { value: '11', label: 'Tubal Ligation' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!procedureData.packageName || !procedureData.category) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/AddProcedurePackage?userId=${userId}`,
        procedureData,{headers:{Authorization:`Bearer ${token}`}}
      );
      if(response){
        Swal.fire({
          title: 'Procedure Package Added Successfully',
          text: 'Procedure Package Added Successfully',
          icon:'success',
        })
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
      Swal.fire({
        title: 'Error',
        text: 'Failed to add Procedure Package.',
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
                <MainBtn bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`} btext="Add Package" optclas="" />
              </div>
            </Form>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default AddProcedurePackage;
