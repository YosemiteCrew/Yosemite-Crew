"use client";
import React, { useState } from "react";
import { Button, Dropdown, FormControl } from "react-bootstrap";
import "./DataTable.css";
import { Icon } from "@iconify/react/dist/iconify.js";

type Item = {
  id: number;
  name: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
};

const initialData: Item[] = [
  { id: 1, name: "Pre-Surgery Consultation", description: "Initial assessment", qty: 1, unitPrice: 100.0, discount: 0, tax: 5 },
  { id: 2, name: "Anesthesia", description: "Sedation and monitoring", qty: 1, unitPrice: 500.0, discount: 0, tax: 5 },
  { id: 3, name: "Keyhole Surgery", description: "Minimally invasive surgery", qty: 1, unitPrice: 3500.0, discount: 10, tax: 5 },
  { id: 4, name: "Post-Op Care & Recovery", description: "Medication, wound care", qty: 1, unitPrice: 250.0, discount: 5, tax: 5 },
  { id: 5, name: "Hospital Stay (if needed)", description: "Overnight monitoring", qty: 1, unitPrice: 600.0, discount: 10, tax: 5 },
  { id: 6, name: "E-Collar", description: "Consumables", qty: 1, unitPrice: 15.0, discount: 10, tax: 5 },
];

// Dropdown options for Name
const nameOptions = [
  "Pre-Surgery Consultation",
  "Anesthesia",
  "Keyhole Surgery",
  "Post-Op Care & Recovery",
  "Hospital Stay (if needed)",
  "E-Collar",
];

const AddItemsTable = () => {
  const [items, setItems] = useState<Item[]>(initialData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: "", description: "", qty: "1", unitPrice: "", discount: "", tax: "" });

  const handleEdit = (id: number) => setEditingId(id);

  const handleDelete = (id: number) => setItems(items.filter((item) => item.id !== id));

  const handleSave = () => setEditingId(null);

  const handleItemChange = (id: number, field: keyof Item, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleNewItemChange = (field: string, value: string) => {
    setNewItem({ ...newItem, [field]: value });
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.unitPrice) {
      alert("Item name and Unit Price are required.");
      return;
    }
    const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    const itemToAdd: Item = {
      id: newId,
      name: newItem.name,
      description: newItem.description,
      qty: parseInt(newItem.qty, 10) || 1,
      unitPrice: parseFloat(newItem.unitPrice) || 0,
      discount: parseFloat(newItem.discount) || 0,
      tax: parseFloat(newItem.tax) || 0,
    };
    setItems([...items, itemToAdd]);
    setNewItem({ name: "", description: "", qty: "1", unitPrice: "", discount: "", tax: "" });
  };

  const calculateGrossTotal = (qty: number, unitPrice: number) => (qty * unitPrice).toFixed(2);

  const calculateTotal = (qty: number, unitPrice: number, discount: number, tax: number) => {
    const gross = qty * unitPrice;
    const discounted = gross - gross * (discount / 100);
    const total = discounted + discounted * (tax / 100);
    return total.toFixed(2);
  };

  return (
    <div className="add-items-table-wrapper">

      <div className="TableDiv">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price (USD)</th>
              <th>Gross Total (USD)</th>
              <th>Discount (%)</th>
              <th>Tax (%)</th>
              <th>Total (USD)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {/* Name Column as Custom Dropdown */}
                <td>
                  {editingId === item.id ? (
                    <Dropdown className="Procedureselect" onSelect={(val) => handleItemChange(item.id, "name", val || "")}>
                      <Dropdown.Toggle id={`dropdown-${item.id}`}>
                        <h6>{item.name || "Select Item"}</h6>
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {nameOptions.map((opt, idx) => (
                          <Dropdown.Item key={idx} eventKey={opt}>
                            {opt}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  ) : (
                    item.name
                  )}
                </td>

                <td>
                  {editingId === item.id ? (
                    <FormControl className="prcedureInput" type="text" value={item.description} onChange={(e) => handleItemChange(item.id, "description", e.target.value)} />
                  ) : (
                    item.description
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <FormControl className="prcedureInput" type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, "qty", parseInt(e.target.value, 10))} />
                  ) : (
                    item.qty
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <FormControl className="prcedureInput" type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, "unitPrice", parseFloat(e.target.value))} />
                  ) : (
                    item.unitPrice.toFixed(2)
                  )}
                </td>
                <td>{calculateGrossTotal(item.qty, item.unitPrice)}</td>
                <td>
                  {editingId === item.id ? (
                    <FormControl className="prcedureInput" type="number" value={item.discount} onChange={(e) => handleItemChange(item.id, "discount", parseFloat(e.target.value))} />
                  ) : (
                    `${item.discount}%`
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <FormControl className="prcedureInput" type="number" value={item.tax} onChange={(e) => handleItemChange(item.id, "tax", parseFloat(e.target.value))} />
                  ) : (
                    `${item.tax}%`
                  )}
                </td>
                <td>${calculateTotal(item.qty, item.unitPrice, item.discount, item.tax)}</td>
                <td>
                  <div className="action-buttons">
                    {editingId === item.id ? (
                      <Button variant="link" className="action-btn Save" onClick={handleSave}>
                        <Icon icon="fa:save" width="22" height="22" />
                      </Button>
                    ) : (
                      <Button variant="link" className="action-btn" onClick={() => handleEdit(item.id)}>
                        <Icon icon="solar:pen-bold" width="22" height="22" />
                      </Button>
                    )}
                    <Button variant="link" className="action-btn" onClick={() => handleDelete(item.id)}>
                      <Icon icon="solar:trash-bin-trash-bold" width="22" height="22" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add New Item Form */}
        <div className="add-item-form">
          {/* Name as Custom Dropdown */}
          <Dropdown className="Procedureselect" onSelect={(val) => handleNewItemChange("name", val || "")}>
            <Dropdown.Toggle id="new-name-dropdown">
              <h6>{newItem.name || "Select Item"}</h6>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {nameOptions.map((opt, idx) => (
                <Dropdown.Item key={idx} eventKey={opt}>
                  {opt}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <FormControl className="prcedureInput" placeholder="Description" value={newItem.description} onChange={(e) => handleNewItemChange("description", e.target.value)} />
          <FormControl className="prcedureInput" placeholder="Qty" type="number" value={newItem.qty} onChange={(e) => handleNewItemChange("qty", e.target.value)} />
          <FormControl className="prcedureInput" placeholder="Unit Price" type="number" value={newItem.unitPrice} onChange={(e) => handleNewItemChange("unitPrice", e.target.value)} />
          <FormControl className="prcedureInput" placeholder="Discount" type="number" value={newItem.discount} onChange={(e) => handleNewItemChange("discount", e.target.value)} />
          <FormControl className="prcedureInput" placeholder="Tax" type="number" value={newItem.tax} onChange={(e) => handleNewItemChange("tax", e.target.value)} />
        </div>
      </div>

      <div className="table-footerBtn">
        <Button onClick={handleAddItem}>
          <Icon icon="carbon:add-filled" width="22" height="22" /> Add Item
        </Button>
      </div>
    </div>
  );
};

export default AddItemsTable;
