"use client";
import React, { useState } from "react";
import { Button, FormControl } from "react-bootstrap";
import { FaRegTrashAlt } from "react-icons/fa";
import { MdModeEditOutline } from "react-icons/md";
import { IoAddCircle } from "react-icons/io5";
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
  { id: 1, name: "Pre-Surgery Consultation", description: "Initial assessment", qty: 1, unitPrice: 100.00, discount: 0, tax: 5 },
  { id: 2, name: "Anesthesia", description: "Sedation and monitoring", qty: 1, unitPrice: 500.00, discount: 0, tax: 5 },
  { id: 3, name: "Keyhole Surgery", description: "Minimally invasive surgery", qty: 1, unitPrice: 3500.00, discount: 10, tax: 5 },
  { id: 4, name: "Post-Op Care & Recovery", description: "Medication, wound care", qty: 1, unitPrice: 250.00, discount: 5, tax: 5 },
  { id: 5, name: "Hospital Stay (if needed)", description: "Overnight monitoring", qty: 1, unitPrice: 600.00, discount: 10, tax: 5 },
  { id: 6, name: "E-Collar", description: "Consumables", qty: 1, unitPrice: 15.00, discount: 10, tax: 5 },
];

const AddItemsTable = () => {
  const [items, setItems] = useState<Item[]>(initialData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: "", description: "", qty: "1", unitPrice: "", discount: "", tax: "" });

  const handleEdit = (id: number) => {
    setEditingId(id);
  };

  const handleDelete = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    setEditingId(null);
  };

  const handleItemChange = (id: number, field: keyof Item, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleNewItemChange = (field: string, value: string) => {
    setNewItem({ ...newItem, [field]: value });
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.unitPrice) {
        alert("Item name and Unit Price are required.");
        return;
    }
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
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
    const discounted = gross - (gross * (discount / 100));
    const total = discounted + (discounted * (tax / 100));
    return total.toFixed(2);
  };

  return (
    <div className="add-items-table-wrapper">
      <div className="TableDiv">
        <table className="">
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
                <td><p> {editingId === item.id ? <FormControl type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} /> : item.name} </p></td>
                <td><p> {editingId === item.id ? <FormControl type="text" value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} /> : item.description} </p></td>
                <td><p> {editingId === item.id ? <FormControl type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value, 10))} /> : item.qty} </p></td>
                <td><p> {editingId === item.id ? <FormControl type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value))} /> : item.unitPrice.toFixed(2)} </p></td>
                <td><p> {calculateGrossTotal(item.qty, item.unitPrice)} </p></td>
                <td><p> {editingId === item.id ? <FormControl type="number" value={item.discount} onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value))} /> : `${item.discount}%`} </p></td>
                <td><p> {editingId === item.id ? <FormControl type="number" value={item.tax} onChange={(e) => handleItemChange(item.id, 'tax', parseFloat(e.target.value))} /> : `${item.tax}%`} </p></td>
                <td><p> ${calculateTotal(item.qty, item.unitPrice, item.discount, item.tax)}</p></td>
                <td>
                  <div className="action-buttons">
                    {editingId === item.id ? (
                      <Button variant="link" className="action-btn Save" onClick={() => handleSave()}>Save</Button>
                    ) : (
                      <Button variant="link" className="action-btn" onClick={() => handleEdit(item.id)}>
                        <Icon icon="solar:pen-bold" width="20" height="20" />
                      </Button>
                    )}
                    <Button variant="link" className="action-btn" onClick={() => handleDelete(item.id)}>
                      <Icon icon="solar:trash-bin-trash-bold" width="20" height="20" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-item-form">
          <FormControl placeholder="Item name" value={newItem.name} onChange={(e) => handleNewItemChange('name', e.target.value)} />
          <FormControl placeholder="Description" value={newItem.description} onChange={(e) => handleNewItemChange('description', e.target.value)} />
          <FormControl placeholder="Qty" type="number" value={newItem.qty} onChange={(e) => handleNewItemChange('qty', e.target.value)} />
          <FormControl placeholder="Unit Price" type="number" value={newItem.unitPrice} onChange={(e) => handleNewItemChange('unitPrice', e.target.value)} />
          <FormControl placeholder="Discount" type="number" value={newItem.discount} onChange={(e) => handleNewItemChange('discount', e.target.value)} />
          <FormControl placeholder="Tax" type="number" value={newItem.tax} onChange={(e) => handleNewItemChange('tax', e.target.value)} />
        </div>
      </div>
      <div className="table-footerBtn">
        <Button onClick={handleAddItem}><Icon icon="carbon:add-filled" width="20" height="20" /> Add Item</Button>
      </div>
    </div>
  );
};

export default AddItemsTable;