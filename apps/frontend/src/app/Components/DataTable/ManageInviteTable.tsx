"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css"


type CardiolgyItems = {
  name: string;
  subName: string;
  email: string;
  specialize: string;
  number: string;
  inviteon: string;
  inviteby: string;
  status: string;
};

const Cardiolgy: CardiolgyItems[] = [

  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: " ",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Pending",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Expire",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Expire",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: " ",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Pending",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Expire",
  },
  {
    name: "Dr. Floyd Miles",
    subName: "Tumor & Chemotherapy Consultant",
    email: "dvm.lauraevans@yc.com",
    specialize: "Oncology",
    number: "(704) 555-0127",
    inviteon: "Apr 15, 2025",
    inviteby: "Admin",
    status: "Expire",
  },
 


];

const columns = [


  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: CardiolgyItems) => (
      <div>
        <p>{item.name}</p>
        <span> {item.subName}</span>
      </div>
    ),
  },
  {
    label: "Specialization",
    key: "specialization",
    render: (item: CardiolgyItems) => (
      <p>{item.specialize}</p>
    ),
  },
  {
    label: "Email Address",
    key: "email",
    // width: "150px",
    render: (item: CardiolgyItems) => (
      <p>{item.email}</p>
    ),
  },
  {
    label: "Phone Number",
    key: "phone",
    // width: "180px",
    render: (item: CardiolgyItems) => <p>{item.number}</p>,
  },
 
  {
    label: "Invited on",
    key: "inviteon",
    // width: "150px",
    render: (item: CardiolgyItems) => (
      <div>
        <p>{item.inviteon}</p>
      </div>
    ),
  },
  {
    label: "Invited by",
    key: "invitedby",
    // width: "150px",
    render: (item: CardiolgyItems) => (
      <div>
        <p>{item.inviteby}</p>
      </div>
    ),
  },
  {
  label: "Status",
  key: "status",
  render: (item: CardiolgyItems) => (
    <div className="CardilogyStatus">
      {item.status === "Pending" ? (
        <h6 className="on-pending" title="Pending">
          Pending
        </h6>
      ) : item.status === "off-duty" ? (
        <h6 className="on-duty" title="off-duty">
          Off-Duty
        </h6>
      ) : item.status === "Expire" ? (
        <h6 className="on-expire" title="Expire">
          Expired
        </h6>
      ) : (
        <h6
          className="circle-btn view"
          title="View"
          onClick={() => console.log("View", item)}
        >
          Available
        </h6>
      )}
    </div>
  ),
},



];


function ManageInviteTable() {
  return (
    <>
        <div className="table-wrapper">
          <GenericTable data={Cardiolgy} columns={columns} bordered={false} />
        </div>





    </>
  )
}

export default ManageInviteTable