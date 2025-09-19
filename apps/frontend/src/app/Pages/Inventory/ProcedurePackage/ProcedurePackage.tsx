"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./ProcedurePackage.css";
import AddItemsTable from "@/app/Components/DataTable/AddItemsTable";
import { Button, Col, Container, Row } from "react-bootstrap";
import { FormInput } from "../../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { getData, postData } from "@/app/axios-services/services";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { BackBtn } from "../../AddVetProfile/AddProileDetails";
import { Icon } from "@iconify/react/dist/iconify.js";
import { convertFhirBundleToInventory } from "@yosemite-crew/fhir";

function ProcedurePackage() {
  const [packageName, setPackageName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [inventoryData, setInventoryData] = useState([]);
  const [packageItems, setPackageItems] = useState<any[]>([]); // ✅ lifted up state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const businessId = useOldAuthStore((state) => state.userId);
  const userType = useOldAuthStore((state) => state.userType);
  useEffect(() => {
    fetchInventoryDetails();
  }, []);

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

    if (packageItems.length === 0) {
      newErrors.packageItems = "At least one package item is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save package
  const handleSavePackage = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        businessId: businessId,
        packageName,
        category,
        description,
        packageItems,
        creatorRole: userType,
      };

      const res = await postData(`/fhir/v1/AddProcedurePackage`, payload, {
        withCredentials: true,
      });

      console.log(res.data, "hurra");
      setErrors({});
      // Reset form
      setPackageName("");
      setCategory("");
      setDescription("");
      setPackageItems([]);
    } catch (error: any) {
      console.error(error);
      setErrors({
        api:
          error.response?.data?.issue?.[0]?.details?.text ||
          "Failed to save procedure package.",
      });
    }
  };
  const fetchInventoryDetails = async (searchCategory?: any) => {
    // console.log(searchCategory, "searchCategory");
    try {
      const queryParams = new URLSearchParams({
        searchCategory,
      });

      const response = await getData(
        `/api/inventory/getInventoryDataForProcedureItems`
      );

      if (!response) {
        throw new Error("Network response was not ok");
      }

      const data: any = await response.data;
      // console.log(data, "FHIR Inventory Data");

      const convertToJson: any = convertFhirBundleToInventory(data);
      console.log(convertToJson, "Converted Inventory JSON");

      setInventoryData(convertToJson.data);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };
  return (
    <section className="ProcedurePackageSec">
      <Container>
        <div className="ProcedurePackageData">
          <BackBtn
            href="/inventorydashboard"
            icon="solar:round-alt-arrow-left-outline"
            backtext="Back"
          />

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
                  {errors.packageName && (
                    <p className="text-danger small">{errors.packageName}</p>
                  )}
                </Col>
                <Col md={6}>
                  <DynamicSelect
                    options={options}
                    value={category}
                    onChange={setCategory}
                    inname="Category"
                    placeholder="Select Category"
                  />
                  {errors.category && (
                    <p className="text-danger small">{errors.category}</p>
                  )}
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
                  {errors.description && (
                    <p className="text-danger small">{errors.description}</p>
                  )}
                </Col>
              </Row>
            </div>

            <hr />

            <div className="ProcPackTble">
              <h6>
                Package Items <span>({packageItems.length})</span>
              </h6>
              <AddItemsTable
                items={packageItems}
                setItems={setPackageItems}
                categoryItem={inventoryData} // ✅ pass control to parent
              />
              {errors.packageItems && (
                <p className="text-danger small">{errors.packageItems}</p>
              )}
            </div>

            {errors.api && <p className="text-danger small">{errors.api}</p>}
          </div>

          <div className="AddPackageBtn">
            <Button onClick={handleSavePackage}>
              <Icon icon="carbon:checkmark-filled" width="22" height="22" /> Add
              Package
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default ProcedurePackage;
