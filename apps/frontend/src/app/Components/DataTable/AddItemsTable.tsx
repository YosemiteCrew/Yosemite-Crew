"use client";
import React, { useState } from "react";
import { Button, Dropdown, FormControl } from "react-bootstrap";
import "./DataTable.css";
import { Icon } from "@iconify/react/dist/iconify.js";

type Item = {
  id: number;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  itemType?: string; // ✅ from categoryItem.itemCategory
};

interface InventoryItem {
  _id: { $oid: string };
  itemName: string;
  itemCategory: string;
  perQtyPrice: number;
  stockReorderLevel: number;
}

interface Props {
  items?: Item[];
  setItems?: React.Dispatch<React.SetStateAction<Item[]>>;
  categoryItem?: any[];
}

const AddItemsTable: React.FC<Props> = ({ items, setItems, categoryItem }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({
    id:0,
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discount: "",
    tax: "",
    subtotal: "",
  });

  const handleEdit = (id: number) => setEditingId(id);

  const handleDelete = (id: number) =>{
    if (setItems && items){
      setItems(items.filter((item) => item.id !== id));

    }
  }
  const handleSave = () => setEditingId(null);

  const handleItemChange = (
    id: number,
    field: keyof Item,
    value: string | number
  ) => {
    if (!setItems || !items || !categoryItem) return;
    const updated = items.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        if (field === "quantity") {
          const selected = categoryItem.find((ci) => ci.itemName === item.name);
          const quantity = Math.max(1, Number(value));
          if (selected && quantity > selected.stockReorderLevel) {
            alert(`Only ${selected.stockReorderLevel} items available in stock.`);
            return item; // do not update
          }
          updatedItem.quantity = quantity;
        }
        return updatedItem;
      }
      return item;
    });

    setItems(updated);
  };

  const handleNewItemChange = (field: string, value: string) => {
    if (field === "name") {
      if (!categoryItem) return;
      const selected = categoryItem.find((ci) => ci.itemName === value);
      if (selected) {
        setNewItem({
          ...newItem,
          name: selected.itemName,
          quantity: "1",
          unitPrice: String(selected.perQtyPrice),
        });
        return;
      }
    }
    setNewItem({ ...newItem, [field]: value });
  };

const handleAddItem = () => {
  if (!newItem.name) {
    alert("Please select an item.");
    return;
  }
if (!setItems || !items || !categoryItem) return;
  const selected = categoryItem.find((ci) => ci.itemName === newItem.name);
  if (!selected) return;

  // ✅ prevent duplicates
  const alreadyExists = items.some((i) => i.name === selected.itemName);
  if (alreadyExists) {
    alert("This item has already been added.");
    return;
  }

  const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;

  const itemToAdd: Item = {
    id: newId,
    name: selected.itemName,
    description: newItem.description,
    quantity: parseInt(newItem.quantity, 10) || 1,
    unitPrice: selected.perQtyPrice,
    discount: parseFloat(newItem.discount) || 0,
    tax: parseFloat(newItem.tax) || 0,
    itemType: selected.itemCategory,
  };

  setItems([...items, itemToAdd]);
  setNewItem({
    id:0,
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discount: "",
    tax: "",
    subtotal: "",
  });
};


  const calculateGrossTotal = (qty: number, unitPrice: number) =>
    (qty * unitPrice).toFixed(2);

  const calculateTotal = (
    qty: number,
    unitPrice: number,
    discount: number,
    tax: number
  ) => {
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
            {items && items.map((item) => (
              <tr key={item.id}>
                {/* Name Column */}
                <td>
                  {editingId === item.id ? (
                    <Dropdown
                      className="Procedureselect"
                      onSelect={(val) =>
                        handleItemChange(item.id, "name", val || "")
                      }
                    >
                      <Dropdown.Toggle id={`dropdown-${item.id}`}>
                        <h6>{item.name || "Select Item"}</h6>
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {categoryItem && categoryItem.map((opt, idx) => (
                          <Dropdown.Item key={idx} eventKey={opt.itemName}>
                            {opt.itemName}
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
                    <FormControl
                      className="prcedureInput"
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(item.id, "description", e.target.value)
                      }
                    />
                  ) : (
                    item.description
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <FormControl
                      className="prcedureInput"
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(item.id, "quantity", e.target.value)
                      }
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td>{item.unitPrice.toFixed(2)}</td>
                <td>{calculateGrossTotal(item.quantity, item.unitPrice)}</td>
                <td>
                  {editingId === item.id ? (
                    <FormControl
                      className="prcedureInput"
                      type="number"
                      value={item.discount}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "discount",
                          parseFloat(e.target.value)
                        )
                      }
                    />
                  ) : (
                    `${item.discount}%`
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <FormControl
                      className="prcedureInput"
                      type="number"
                      value={item.tax}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "tax",
                          parseFloat(e.target.value)
                        )
                      }
                    />
                  ) : (
                    `${item.tax}%`
                  )}
                </td>
                <td>
                  ${calculateTotal(
                    item.quantity,
                    item.unitPrice,
                    item.discount,
                    item.tax
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    {editingId === item.id ? (
                      <Button
                        variant="link"
                        className="action-btn Save"
                        onClick={handleSave}
                      >
                        <Icon icon="fa:save" width="22" height="22" />
                      </Button>
                    ) : (
                      <Button
                        variant="link"
                        className="action-btn"
                        onClick={() => handleEdit(item.id)}
                      >
                        <Icon icon="solar:pen-bold" width="22" height="22" />
                      </Button>
                    )}
                    <Button
                      variant="link"
                      className="action-btn"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Icon
                        icon="solar:trash-bin-trash-bold"
                        width="22"
                        height="22"
                      />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add New Item Form */}
        <div className="add-item-form">
          <Dropdown
            className="Procedureselect"
            onSelect={(val) => handleNewItemChange("name", val || "")}
          >
            <Dropdown.Toggle id="new-name-dropdown">
              <h6>{newItem.name || "Select Item"}</h6>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {categoryItem && categoryItem.map((opt, idx) => (
                <Dropdown.Item key={idx} eventKey={opt.itemName}>
                  {opt.itemName}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <FormControl
            className="prcedureInput"
            placeholder="Description"
            value={newItem.description}
            onChange={(e) =>
              handleNewItemChange("description", e.target.value)
            }
          />
          <FormControl
            className="prcedureInput"
            placeholder="Quantity"
            type="number"
            value={newItem.quantity}
            onChange={(e) => handleNewItemChange("quantity", e.target.value)}
          />
          <FormControl
            className="prcedureInput"
            placeholder="Unit Price"
            type="number"
            value={newItem.unitPrice}
            readOnly // ✅ always from inventory
          />
          <FormControl
            className="prcedureInput"
            placeholder="Gross Total (USD"
            type="number"
            value={newItem.unitPrice}
            readOnly // ✅ always from inventory
          />
          <FormControl
            className="prcedureInput"
            placeholder="Discount"
            type="number"
            value={newItem.discount}
            onChange={(e) => handleNewItemChange("discount", e.target.value)}
          />
          <FormControl
            className="prcedureInput"
            placeholder="Tax"
            type="number"
            value={newItem.tax}
            onChange={(e) => handleNewItemChange("tax", e.target.value)}
          />
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
