"use client";
import React, { useState, useEffect } from 'react';
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css";
import { Button, Dropdown, Form } from "react-bootstrap";
import { FaRegTrashAlt } from "react-icons/fa";
import { MdModeEditOutline } from "react-icons/md";
import { LuSearch } from "react-icons/lu";
import axios from "axios";
import { Column } from "../GenericTable/GenericTable";
import { getData, postData } from '@/app/axios-services/services';

const Switch = ({ id, checked, onChange }: { id: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  return (
    <Form.Check
      type="switch"
      id={id}
      checked={checked}
      onChange={onChange}
    />
  );
};

type DiscountsItem = {
  _id:string;
  isActive: boolean;
  code: string;
  couponType: string;
  typeoff: string;
  createdOn: string;
  validTill: string;
  count: number;
  status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue";
};



function ManageDiscountTable() {
  const [discounts, setDiscounts] = useState<DiscountsItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("Coupon Type");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Status");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [updateSwitchToggle, setUpdateSwitchToggle] = useState(false);
  const columns: Column<DiscountsItem>[] = [
    {
      label: "",
      key: "isActive",
      width: "60px",
      render: (item: DiscountsItem, index: number) => (
        <Switch
          id={`switch-${index}`}
          checked={item.isActive}
          onChange={() => updateSwitch(item._id,!item.isActive)}
        />
      ),
    },
    {
      label: "Discount Code",
      key: "code",
      render: (item: DiscountsItem) => <p>{item.code}</p>,
    },
    {
      label: "Type",
      key: "couponType",
      render: (item: DiscountsItem) => (
        <div>
          <p>{item.couponType}</p>
          <span>{item.typeoff}</span>
        </div>
      ),
    },
    {
      label: "Created On",
      key: "createdOn",
      render: (item: DiscountsItem) => <p>{item.createdOn}</p>,
    },
    {
      label: "Expiry Date",
      key: "validTill",
      render: (item: DiscountsItem) => <p>{item.validTill}</p>,
    },
    {
      label: "Usage Count",
      key: "count",
      render: (item: DiscountsItem) => <p>{item.count}</p>,
    },
    {
      label: "Status",
      key: "status",
      render: (item: DiscountsItem) => (
        <div className={`statusbadgebtn ${item.status.toLowerCase().replace(/ /g, "-")}`}>
          {item.status}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "100px",
      render: () => (
        <div className="Procedaction-buttons">
          <Button variant="link" className="action-btn">
            <MdModeEditOutline size={20} />
          </Button>
          <Button variant="link" className="action-btn">
            <FaRegTrashAlt size={20} />
          </Button>
        </div>
      ),
    },
  ];
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Searching for: ${search}`);
  };


  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      // const res = await axios.get("http://localhost:8034/get-all-discounts");
      const res:any =await getData("/fhir/v1/allDiscountCoupon");
      console.log(res,"RESSSSSSSSSSSSSSS")
      setDiscounts(res?.data?.data);
    } catch (error) {
      console.error("Error fetching discounts", error);
    } finally {
      setLoading(false);
    }
  };
  const updateSwitch   = async (id:any,value:boolean) => {
    
    // setLoading(true);
    try {
      // const res = await axios.get("http://localhost:8034/get-all-discounts");
      const res:any =await postData(`/fhir/v1/updateCoupon/${id}`,{isActive:value});
      // await fetchDiscounts()
      setUpdateSwitchToggle(!updateSwitchToggle)
    } catch (error) {
      console.error("Error fetching discounts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, [updateSwitchToggle]);

  return (
    <>
      <div className="TableDropdownWrapper">
        <div className="RightTopTbl">
          <Form className="Tblserchdiv" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Code Name"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Button type="submit"><LuSearch size={20} /></Button>
          </Form>
          <div className="StatusSlect">
            <Dropdown onSelect={val => setSelectedStatus(val || "Amount")}>
              <Dropdown.Toggle id="status-dropdown">{selectedStatus}</Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <div className="StatusSlect">
            <Dropdown onSelect={val => setSelectedPaymentStatus(val || "Payment Status")}>
              <Dropdown.Toggle id="status-dropdown">{selectedPaymentStatus}</Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        <div className="table-wrapper">
          {/* {loading ? (
            <p>Loading discounts...</p>
          ) : ( */}
            <GenericTable data={discounts} columns={columns} bordered={false} pagination pageSize={6} />
          {/* )} */}
        </div>
      </div>
    </>
  );
}

export default ManageDiscountTable;
