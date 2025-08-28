"use client";
import React, { useCallback, useState } from "react";
import "./ProcedurePackage.css";
import AddItemsTable from "@/app/Components/DataTable/AddItemsTable";
import { Button, Col, Container, Row } from "react-bootstrap";
import { FormInput } from "../../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { postData } from "@/app/axios-services/services";
import { useAuthStore } from "@/app/stores/authStore";
import { BackBtn } from "../../AddVetProfile/AddProileDetails";
import { Icon } from "@iconify/react/dist/iconify.js";

function ProcedurePackage() {
  const [packageName, setPackageName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [packageItems, setPackageItems] = useState<any[]>([]); // Items from AddItemsTable
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const businessId = useAuthStore((state) => state.userId);
  const userType = useAuthStore((state) => state.userType);

  // Handle package name
  const handleBusinessInformation = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPackageName(e.target.value);
    },
    []
  );

  type Option = { value: string; label: string };
  const options: Option[] = [
    { value: "General", label: "General" },
    { value: "Special", label: "Special" },
    { value: "Premium", label: "Premium" },
  ];

  // Validation
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!packageName.trim()) {
      newErrors.packageName = "Package name is required.";
    }

    if (!category) {
      newErrors.category = "Category is required.";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required.";
    } else if (description.length < 10) {
      newErrors.description = "Description must be at least 10 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save package
  const handleSavePackage = async () => {
    if (!validateForm()) return; // Stop if validation fails

    try {
      const payload = {
        bussinessId: businessId, // required in schema
        packageName,
        category,
        description,
        packageItems,
        creatorRole:userType // included but not validated here
      };

      const res = await postData(`/fhir/v1/AddProcedurePackage`, payload, {
        withCredentials: true,
      });

      console.log(res.data, "hurra");
      setErrors({});
    } catch (error: any) {
      console.error(error);
      setErrors({ api: error.response?.data?.issue?.[0]?.details?.text || "Failed to save procedure package." });
    }
  };

  return (
    <section className="ProcedurePackageSec">
      <Container>
        <div className="ProcedurePackageData">

          <BackBtn href="/inventorydashboard" icon="solar:round-alt-arrow-left-outline" backtext="Back" />

          <h2>Add Procedure Package</h2>

          <div className="ProsPackageCard">

            <div className="PackageForm">
              <Row>
                <Col md={6}>
                  <FormInput
                    intype="text"
                    inname="packageName"
                    value={packageName}
                    inlabel="Package Name"
                    onChange={handleBusinessInformation}
                  />
                  {errors.packageName && <p className="text-danger small">{errors.packageName}</p>}
                </Col>
                <Col md={6}>
                  <DynamicSelect
                    options={options}
                    value={category}
                    onChange={setCategory}
                    inname="Category"
                    placeholder="Select Category"
                  />
                  {errors.category && <p className="text-danger small">{errors.category}</p>}
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <div className="form-floating">
                    <textarea
                      className="form-control"
                      placeholder="Short description of the procedure."
                      id="floatingTextarea2"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                    <label htmlFor="floatingTextarea2">
                      Short description of the procedure.
                    </label>
                  </div>
                  {errors.description && <p className="text-danger small">{errors.description}</p>}
                </Col>
              </Row>
            </div>

            <hr />

            <div className="ProcPackTble">
              <h6>
                Package Items <span>({packageItems.length})</span>
              </h6>
              {/* Pass callback to update state */}
              <AddItemsTable />
            </div>

            {errors.api && <p className="text-danger small">{errors.api}</p>}
          </div>

          <div className="AddPackageBtn">
            <Button onClick={handleSavePackage}> <Icon icon="carbon:checkmark-filled" width="22" height="22" /> Add Package </Button>
          </div>
          
        </div>
      </Container>
    </section>
  );
}

export default ProcedurePackage;
