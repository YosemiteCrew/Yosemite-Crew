"use client";
import React, { useState } from "react";
import "./ManageDiscounts.css";
import { Button, Col, Container, Row } from "react-bootstrap";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";
import ManageDiscountTable from "@/app/Components/DataTable/ManageDiscountTable";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import { postData } from "@/app/axios-services/services";

interface ErrorsType {
  discountCodeName?: string;
  discountCode?: string;
  services?: string;
  couponType?: string;
  couponTypeValue?: string;
  minOrderValue?: string;
  validTill?: string;
  description?: string;
}

function ManageDiscounts() {
  const [discountLead, setDiscountLead] = useState(false);

  const [formData, setFormData] = useState({
    discountCodeName: "",
    discountCode: "",
    services: "",
    couponType: "",
    couponTypeValue: "",
    minOrderValue: "",
    validTill: "",
    description: "",
  });

  const [errors, setErrors] = useState<ErrorsType>({});
  const [loading, setLoading] = useState<boolean>(false);

  const options = [
    { value: "percentage", label: "Percentage" },
    { value: "fixedAmount", label: "Fixed amount" },
  ];

  const validate = () => {
    const newErrors: ErrorsType = {};

    if (!formData.discountCodeName.trim()) {
      newErrors.discountCodeName = "Discount Code Name is required.";
    }

    if (!formData.discountCode.trim()) {
      newErrors.discountCode = "Discount Code is required.";
    }

    if (!formData.services.trim()) {
      newErrors.services = "Please select service type.";
    }

    if (!formData.couponType.trim()) {
      newErrors.couponType = "Coupon Type is required.";
    }

    if (!formData.couponTypeValue.toString().trim()) {
      newErrors.couponTypeValue = "Coupon Value is required.";
    } else if (isNaN(Number(formData.couponTypeValue)) || Number(formData.couponTypeValue) <= 0) {
      newErrors.couponTypeValue = "Coupon Value must be a positive number.";
    }

    if (formData.minOrderValue) {
      if (isNaN(Number(formData.minOrderValue)) || Number(formData.minOrderValue) < 0) {
        newErrors.minOrderValue = "Min Order Value must be a positive number or zero.";
      }
    }

    if (!formData.validTill.trim()) {
      newErrors.validTill = "Valid Till date is required.";
    } else {
      const selectedDate = new Date(formData.validTill);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (selectedDate < now) {
        newErrors.validTill = "Valid Till date must be today or a future date.";
      }
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for the field on change
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleDateChange = (date: string | null) => {
    setFormData((prev) => ({
      ...prev,
      validTill: date || "",
    }));
    setErrors((prev) => ({ ...prev, validTill: undefined }));
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    try {
        setLoading(true);
      const response = await postData("/fhir/v1/addDiscountCoupon", { formData });
      const data = await response.data;
      console.log("Success:", data);
      alert("Discount Code Added Successfully");

      // Reset form and close add discount
      setDiscountLead(false);
      setFormData({
        discountCodeName: "",
        discountCode: "",
        services: "",
        couponType: "",
        couponTypeValue: "",
        minOrderValue: "",
        validTill: "",
        description: "",
      });
      setErrors({});
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      alert("Failed to add discount code, please try again.");
    }
  };

  return (
    <section className="ManageDiscountSec">
      <Container>
        {!discountLead ? (
          <div className="ManageDiscountData">
            <div className="ManageTopBar">
              <h2>Manage Discounts</h2>
              <Link href="" onClick={() => setDiscountLead(true)}>
                <Icon icon="solar:add-circle-bold" width="20" height="20" /> Request New Coupons
              </Link>
            </div>
            <ManageDiscountTable />
          </div>
        ) : (
          <div className="AddDiscountData">
            <div className="DicountInner">
              <HeadText blktext="Add" Spntext="New Discount Code" />
              <div className="DiscountForm">
                <Row>
                  <Col md={12}>
                    <FormInput
                      intype="text"
                      inname="discountCodeName"
                      value={formData.discountCodeName}
                      inlabel="Discount Code Name"
                      onChange={handleChange}
                      error={errors.discountCodeName}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormInput
                      intype="text"
                      inname="discountCode"
                      value={formData.discountCode}
                      inlabel="Discount Code"
                      onChange={handleChange}
                      error={errors.discountCode}
                    />
                  </Col>
                  <Col md={6}>
                    <DynamicSelect
                      options={[
                        { value: "grooming", label: "Grooming" },
                        { value: "spa", label: "Spa" },
                        { value: "haircut", label: "Haircut" },
                      ]}
                      value={formData.services}
                      onChange={(val) => handleSelectChange("services", val)}
                      inname="services"
                      placeholder="Select Services"
                      error={errors.services}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <DynamicSelect
                      options={options}
                      value={formData.couponType}
                      onChange={(val) => handleSelectChange("couponType", val)}
                      inname="couponType"
                      placeholder="Coupon Type"
                      error={errors.couponType}
                    />
                  </Col>
                  <Col md={6}>
                    <FormInput
                      intype="number"
                      inname="couponTypeValue"
                      value={formData.couponTypeValue}
                      inlabel="Coupon Value"
                      onChange={handleChange}
                      error={errors.couponTypeValue}
                    //   min={0}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormInput
                      intype="number"
                      inname="minOrderValue"
                      value={formData.minOrderValue}
                      inlabel="Min Order Value"
                      onChange={handleChange}
                      error={errors.minOrderValue}
                    //   min={0}
                    />
                  </Col>
                  <Col md={6}>
                    <DynamicDatePicker
                      placeholder="Valid Till"
                      value={formData.validTill}
                      onDateChange={handleDateChange}
                    //   error={errors.validTill}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={12}>
                    <FormInput
                      intype="text"
                      inname="description"
                      value={formData.description}
                      inlabel="Offer Description. Eg - 20% OFF on Grooming Services"
                      onChange={handleChange}
                      error={errors.description}
                    />
                  </Col>
                </Row>
              </div>
            </div>
            <div className="Discountupdtbtn">
              <Button onClick={handleSubmit} disabled={loading}>
                <Icon icon="lets-icons:check-fill" width="32" height="32" /> 
                Add Discount Code
              </Button>
              <Button variant="secondary" style={{ marginLeft: "10px" }} onClick={() => setDiscountLead(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

export default ManageDiscounts;
