'use client';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row } from "react-bootstrap";
import { FormInput } from "../Sign/SignUp";
import type { ModalProps } from "react-bootstrap";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import Image from "next/image";
import { Icon } from "@iconify/react/dist/iconify.js";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { IoSearchOutline } from "react-icons/io5";


// BusinessDetailsModal Started 
export function BusinessDetailsModal(props: ModalProps) {


  // Profile Picture Started
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const sanitizedPreview = previewUrl;
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImage(file);
      }
    };
    const formData = new FormData();
    if (image) {
      formData.append("profilePicture", image);
    }
    useEffect(() => {
      if (image) {
        const url = URL.createObjectURL(image);
        setPreviewUrl(url);
  
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setPreviewUrl("");
      }
    }, [image]);
    // Profile Picture Ended

    const [name, setName] = useState({
      area: "",
    });
    const handleArea = (selectedOption: string) => {
      setName((prev) => ({
        ...prev,
        area: selectedOption 
      }));
    };
    const [email, setEmail] = useState("")
    const [Fname, setFName] = useState("")
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
    <Modal className="SettingModal" {...props} centered >
      <Modal.Body>
        <div className="SetBussinesDiv">
          <Form>
            <Row>
              <Col md={12}>
                <div className="add-logo-container">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <label
                    htmlFor="logo-upload"
                    className="upload-label"
                  >
                    {image && sanitizedPreview ? (
                      <Image
                        src={sanitizedPreview}
                        alt="Preview"
                        className="preview-image"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="upload-placeholder">
                        <Image
                          src="/default-profile.png"
                          alt="camera"
                          className="icon"
                          width={40}
                          height={40}
                        />
                      </div>
                    )}
                  </label>
                  <h5>Edit Logo <Icon icon="solar:pen-bold" width={24} height={24} /></h5>
                </div>
              </Col>
            </Row>
            <Row>
              <Col md={6}><DynamicSelect options={options}  value={name.area} onChange={handleArea}inname="country" placeholder="Area"/></Col>
              <Col md={6}><FormInput readonly={false}intype="number" inname="email" value={email} inlabel="Enter Number" onChange={(e) => setEmail(e.target.value)}/></Col>
            </Row>
            <Row>
              <Col md={12}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="Enter Full Name" onChange={(e) => setFName(e.target.value)}/></Col>
            </Row>
            <Row>
              <Col md={12}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="Enter Full Name" onChange={(e) => setFName(e.target.value)}/></Col>
            </Row>
            <Row>
              <Col md={12}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="Enter Full Name" onChange={(e) => setFName(e.target.value)}/></Col>
            </Row>
            <div className="SetFormBtn">
              <Button>Update <Icon icon="carbon:checkmark-filled" width="24" height="24" /></Button>
            </div>
          </Form>
        </div>
       
      </Modal.Body>
      <div className="ModalCrossBtn">
        <Button onClick={props.onHide}><Icon icon="gridicons:cross" width="24" height="24" /></Button>
      </div>
    </Modal>
  );
}

// BusinessDetailsModal ended 

// AddressDetailsModal Started 
export function AddressDetailsModal(props: ModalProps) {


  const [Fname, setFName] = useState("")
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
    area: "",
  });
  const handleArea = (selectedOption: string) => {
    setName((prev) => ({
      ...prev,
      area: selectedOption 
    }));
  };


  return (
    <Modal {...props}className="SettingModal"centered>
      
      <Modal.Body>
        <div className="AddressSettingDiv">
          <h2><span>Edit your</span> Address Details </h2>

          <div className="AdressInner">
            <h6>Address</h6>
            <Form>
              <Row>
                <Col md={6}><FormInput readonly={false}intype="number" inname="Fname" value={Fname} inlabel="401-782" onChange={(e) => setFName(e.target.value)}/></Col>
                <Col md={6}><DynamicSelect options={options}  value={name.area} onChange={handleArea}inname="country" placeholder="Queen’s Foot Area"/></Col>
              </Row>
              <Row>
                <Col md={12}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="401-782" onChange={(e) => setFName(e.target.value)}/></Col>
              </Row>
              <Row>
                <Col md={6}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="401-782" onChange={(e) => setFName(e.target.value)}/></Col>
                <Col md={6}><FormInput readonly={false}intype="text" inname="Fname" value={Fname} inlabel="401-782" onChange={(e) => setFName(e.target.value)}/></Col>
              </Row>
            </Form>

          </div>

        </div>
        
      </Modal.Body>
      <div className="ModalCrossBtn">
        <Button onClick={props.onHide}><Icon icon="gridicons:cross" width="24" height="24" /></Button>
      </div>
    </Modal>
  );
}
// AddressDetailsModal ended 

// ServiceDetailsModal Started 
export function ServiceDetailsModal(props: ModalProps) {



  return (
    <Modal{...props}className="SettingModal"centered >
      <Modal.Body>

        <div className="SetServicesDiv">

          <h2><span>Edit your</span> Service Details </h2>

          <div className="SetServicesInner">

           

<h1>Complete page se uthana hai </h1>





          </div>

        </div>

      </Modal.Body>

      <div className="ModalCrossBtn">
        <Button onClick={props.onHide}><Icon icon="gridicons:cross" width="24" height="24" /></Button>
      </div>

    </Modal>
  );
}
// ServiceDetailsModal ended 
