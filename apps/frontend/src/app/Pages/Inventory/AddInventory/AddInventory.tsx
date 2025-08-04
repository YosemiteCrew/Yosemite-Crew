'use client';

import * as React from "react";
import { useCallback, useState } from "react";
import "./AddInventory.css";
import { Button, Col, Container, Form, Row, Alert } from 'react-bootstrap';
import { Icon } from '@iconify/react';
import { FormInput } from '../../Sign/SignUp';
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import axios from 'axios';
import { postData } from "@/app/axios-services/services";

interface InventoryFormData {
  barCode: string;
  category: string;
  itemName: string;
  genericName: string;
  department: string;
  sexType: string;
  manufacturer: string;
  itemCategory: string;
  speciesSpecific1: string;
  speciesSpecific2: string;
  onHand: string;
  perQtyPrice: string;
  batchNumber: string;
  sku: string;
  strength: string;
  quantity: number;
  manufacturerPrice: string;
  markup: string;
  upc: string;
  price: string;
  stockReorderLevel: string;
  expiryDate: string;
}

function AddInventory(): React.JSX.Element {
  const [formData, setFormData] = useState<InventoryFormData>({
    barCode: "",
    category: "",
    itemName: "",
    genericName: "",
    department: "",
    sexType: "",
    manufacturer: "",
    itemCategory: "",
    speciesSpecific1: "",
    speciesSpecific2: "",
    onHand: "",
    perQtyPrice: "",
    batchNumber: "",
    sku: "",
    strength: "",
    quantity: 0,
    manufacturerPrice: "",
    markup: "",
    upc: "",
    price: "",
    stockReorderLevel: "",
    expiryDate: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string>("");

 const validate = (data: InventoryFormData): Record<string, string> => {
  const err: Record<string, string> = {};

  const required = (key: keyof InventoryFormData, label: string) => {
    if (!data[key]) err[key] = `${label} is required`;
  };

  const regexChecks: { [K in keyof InventoryFormData]?: { regex: RegExp; message: string } } = {
    barCode: { regex: /^[0-9]{6,20}$/, message: "Barcode must be 6–20 digit number" },
    category: { regex: /^[A-Za-z\s]{2,50}$/, message: "Category must contain only letters & spaces" },
    itemName: { regex: /^[A-Za-z0-9\s]{2,100}$/, message: "Item name must be 2–100 alphanumeric characters" },
    genericName: { regex: /^[A-Za-z\s]{2,100}$/, message: "Generic name must contain only letters" },
    department: { regex: /^[A-Za-z\s]{2,50}$/, message: "Department must contain only letters" },
    sexType: { regex: /^(Male|Female|Unisex)$/, message: "Sex type must be Male, Female, or Unisex" },
    manufacturer: { regex: /^[A-Za-z\s]{2,100}$/, message: "Manufacturer must contain only letters" },
    itemCategory: { regex: /^[A-Za-z\s]{2,100}$/, message: "Item category must contain only letters" },
    speciesSpecific1: { regex: /^[A-Za-z\s]{2,50}$/, message: "Species must contain only letters" },
    speciesSpecific2: { regex: /^[A-Za-z\s]{2,50}$/, message: "Species must contain only letters" },
    onHand: { regex: /^(Yes|No)$/, message: "On hand must be Yes or No" },
    batchNumber: { regex: /^[A-Za-z0-9\-]{2,20}$/, message: "Invalid batch number format" },
    sku: { regex: /^[A-Z0-9\-]{5,30}$/, message: "SKU must be 5–30 uppercase letters, numbers, or dashes" },
    strength: { regex: /^[0-9]{1,4}(mg|g|ml)$/, message: "Strength must end with mg, g, or ml (e.g., 500mg)" },
    upc: { regex: /^[0-9]{12}$/, message: "UPC must be a 12-digit number" },
    expiryDate: { regex: /^\d{4}-\d{2}-\d{2}$/, message: "Expiry date must be in YYYY-MM-DD format" },
    price: { regex: /^\d+(\.\d{1,2})?$/, message: "Price must be a valid number" },
    perQtyPrice: { regex: /^\d+(\.\d{1,2})?$/, message: "Per qty price must be valid" },
    manufacturerPrice: { regex: /^\d+(\.\d{1,2})?$/, message: "Manufacturer price must be valid" },
    markup: { regex: /^\d+(\.\d{1,2})?$/, message: "Markup must be valid percentage" },
  };

  // Required fields
  required("barCode", "Barcode");
  required("category", "Category");
  required("itemName", "Item name");
  required("department", "Department");
  required("manufacturer", "Manufacturer");
  required("itemCategory", "Item category");
  required("sku", "SKU");

  // Regex checks
  for (const key in regexChecks) {
    const check = regexChecks[key as keyof InventoryFormData];
    const value: any = data[key as keyof InventoryFormData];
    if (check && value && !check.regex.test(value)) {
      err[key] = check.message;
    }
  }

  // Quantity validation
  if (isNaN(Number(data.quantity)) || Number(data.quantity) < 0)
    err.quantity = "Quantity must be a non-negative number";

  return err;
};


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: string | null): void => {
    setFormData((prev) => ({ ...prev, expiryDate: date || "" }));
  };

  const handleQuantityChange = (value: number): void => {
    setFormData((prev) => ({ ...prev, quantity: value }));
  };

  const handleSubmit = async (): Promise<void> => {
    setErrors({});
    setSuccessMessage("");

    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        perQtyPrice: Number(formData.perQtyPrice),
        manufacturerPrice: Number(formData.manufacturerPrice),
        markup: Number(formData.markup),
        stockReorderLevel: Number(formData.stockReorderLevel),
      };
const fhir = convertToFhirInventory(payload);
      await postData("/api/inventory/addInventory", fhir);
      setSuccessMessage("Inventory added successfully.");
      setFormData({
        barCode: "",
        category: "",
        itemName: "",
        genericName: "",
        department: "",
        sexType: "",
        manufacturer: "",
        itemCategory: "",
        speciesSpecific1: "",
        speciesSpecific2: "",
        onHand: "",
        perQtyPrice: "",
        batchNumber: "",
        sku: "",
        strength: "",
        quantity: 0,
        manufacturerPrice: "",
        markup: "",
        upc: "",
        price: "",
        stockReorderLevel: "",
        expiryDate: "",
      });
    } catch (error: any) {
      setErrors({ api: error.response?.data?.message || error.message });
    }
  };
console.log(errors)
  return (
    <section className='AddInventorySec'>
      <Container>
        <div className="InventoryData">
          <div className="AddInventoryHead">
            <h2>Add Inventory</h2>
          </div>

          <div className="AddInventryForm">
            <Form>
              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="barCode" value={formData.barCode} inlabel="Bar Code" onChange={handleChange} />
                {errors.barCode && <div className="text-danger">{errors.barCode}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="category" value={formData.category} inlabel="Category" onChange={handleChange} />
                {errors.category && <div className="text-danger">{errors.category}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="itemName" value={formData.itemName} inlabel="Item Name" onChange={handleChange} />
                {errors.itemName && <div className="text-danger">{errors.itemName}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="genericName" value={formData.genericName} inlabel="Generic Name" onChange={handleChange} />
                {errors.genericName && <div className="text-danger">{errors.genericName}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="department" value={formData.department} inlabel="Department" onChange={handleChange} />
                {errors.department && <div className="text-danger">{errors.department}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="sexType" value={formData.sexType} inlabel="Sex Type" onChange={handleChange} />
                {errors.sexType && <div className="text-danger">{errors.sexType}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="manufacturer" value={formData.manufacturer} inlabel="Manufacturer" onChange={handleChange} />
                {errors.manufacturer && <div className="text-danger">{errors.manufacturer}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="itemCategory" value={formData.itemCategory} inlabel="Item Category" onChange={handleChange} />
                {errors.itemCategory && <div className="text-danger">{errors.itemCategory}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="speciesSpecific1" value={formData.speciesSpecific1} inlabel="Species Specific 1" onChange={handleChange} />
                {errors.speciesSpecific1 && <div className="text-danger">{errors.speciesSpecific1}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="speciesSpecific2" value={formData.speciesSpecific2} inlabel="Species Specific 2" onChange={handleChange} />
                {errors.speciesSpecific2 && <div className="text-danger">{errors.speciesSpecific2}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="onHand" value={formData.onHand} inlabel="On Hand" onChange={handleChange} />
                {errors.onHand && <div className="text-danger">{errors.onHand}</div>}
                </Col>
                <Col md={6}>
                  <FormInput intype="number" inname="perQtyPrice" value={formData.perQtyPrice} inlabel="$ Per Qty Price" onChange={handleChange} />
                {errors.perQtyPrice && <div className="text-danger">{errors.perQtyPrice}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={3}>
                  <FormInput intype="text" inname="batchNumber" value={formData.batchNumber} inlabel="Batch Number" onChange={handleChange} />
                {errors.batchNumber && <div className="text-danger">{errors.batchNumber}</div>}
                </Col>
                <Col md={3}>
                  <FormInput intype="text" inname="sku" value={formData.sku} inlabel="SKU" onChange={handleChange} />
                {errors.sku && <div className="text-danger">{errors.sku}</div>}
                </Col>
                <Col md={3}>
                  <FormInput intype="text" inname="strength" value={formData.strength} inlabel="Strength" onChange={handleChange} />
                {errors.strength && <div className="text-danger">{errors.strength}</div>}
                </Col>
                <Col md={3}>
                  <QuantityInput value={formData.quantity} onChange={handleQuantityChange} />
                {errors.quantity && <div className="text-danger">{errors.quantity}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={3}>
                  <FormInput intype="number" inname="manufacturerPrice" value={formData.manufacturerPrice} inlabel="$ Manufacturer Price" onChange={handleChange} />
                {errors.manufacturerPrice && <div className="text-danger">{errors.manufacturerPrice}</div>}
                </Col>
                <Col md={3}>
                  <FormInput intype="number" inname="markup" value={formData.markup} inlabel="% Markup" onChange={handleChange} />
                {errors.markup && <div className="text-danger">{errors.markup}</div>}
                </Col>
                <Col md={3}>
                  <FormInput intype="text" inname="upc" value={formData.upc} inlabel="UPC" onChange={handleChange} />
                {errors.upc && <div className="text-danger">{errors.upc}</div>}
                </Col>
                <Col md={3}>
                  <FormInput intype="number" inname="price" value={formData.price} inlabel="$ Price" onChange={handleChange} />
                {errors.price && <div className="text-danger">{errors.price}</div>}
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <FormInput intype="number" inname="stockReorderLevel" value={formData.stockReorderLevel} inlabel="Stock Reorder Level" onChange={handleChange} />
                {errors.stockReorderLevel && <div className="text-danger">{errors.stockReorderLevel}</div>}
                </Col>
                <Col md={6}>
                  <DynamicDatePicker placeholder="Expiry Date (dd-mm-yyyy)" value={formData.expiryDate} onDateChange={handleDateChange} />
                {errors.expiryDate && <div className="text-danger">{errors.expiryDate}</div>}
                </Col>
              </Row>
            </Form>
          </div>

          <div className="InventryBtn">
            <Button onClick={handleSubmit}>
              <Icon icon="carbon:checkmark-filled" width="24" height="24" /> Add Inventory
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default AddInventory;

interface QuantityInputProps {
  value: number;
  onChange: (val: number) => void;
}
function QuantityInput({ value, onChange }: QuantityInputProps): React.JSX.Element {
  const handleDecrease = (): void => {
    if (value > 0) onChange(value - 1);
  };
  const handleIncrease = (): void => {
    onChange(value + 1);
  };
  return (
    <div className="AddQuanity">
      <Button type="button" onClick={handleDecrease}><Icon icon="solar:minus-circle-bold" width="24" height="24" color="#302F2E" /></Button>
      <span className="quntyname">Quantity</span>
      <span style={{ marginLeft: 16, fontSize: 20, fontWeight: 600 }}>{value}</span>
      <Button type="button" onClick={handleIncrease}><Icon icon="solar:add-circle-bold" width="24" height="24" color="#302F2E" /></Button>
    </div>
  );
}
