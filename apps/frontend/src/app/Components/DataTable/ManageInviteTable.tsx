"use client";
import React, { useEffect, useState } from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css";
import { Button, Dropdown, Form } from "react-bootstrap";
import { deleteData, getData, postData } from "@/app/axios-services/services";
import { useAuthStore } from "@/app/stores/authStore";
import Swal from "sweetalert2";
import { convertFromFhirDepartment, fromFHIRInviteList } from "@yosemite-crew/fhir";
import { InviteCard } from "@yosemite-crew/types";
import { LuSearch } from "react-icons/lu";

function toTitleCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type ManageInviteItems = {
  name: string;
  email: string;
  role: string;
  specialize: string;
  specializeId?: string; // Optional, can be used for filtering
  inviteon: string;
  inviteby: string;
  invitedBy: string;
  status: string;
  action: string;
};

function ManageInviteTable() {
  const { userId } = useAuthStore();
  const [cardiology, setCardiology] = useState<ManageInviteItems[]>([]);
  const [fullInvites, setFullInvites] = useState<ManageInviteItems[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(""); // id
  const [selectedDepartmentName, setSelectedDepartmentName] = useState("Specialization"); // label

  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "All" },
  ]);
  // ✅ Fetch invites (reusable)
  const getInvites = async (): Promise<void> => {
    try {
      const response = await getData(`/fhir/v1/getinvites?userId=${userId}&status=${status}&department=${department}`);
      if (response.status === 200) {
        const data: any = response.data;
        const invitesBack = fromFHIRInviteList(data.invite);
        console.log("invites", invitesBack)
        const mappedInvites: InviteCard[] = invitesBack.map((v) => ({
          name: v.name,
          email: v.email,
          role: toTitleCase(v.role),
          specialize: toTitleCase(v.department),
          specializeId: v.departmentId,
          inviteon: v.invitedAtFormatted,
          inviteby: v.invitedByName,
          invitedBy: v.invitedBy,
          status: v.status,
          action: v.status,
        }));
        setFullInvites(mappedInvites as ManageInviteItems[]);
      }
    } catch (error) {
      console.log("Failed to fetch invites:", error);
    }
  };

  useEffect(() => {
    if (userId) getInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, department, status]);

  useEffect(() => {
    setCardiology(
      fullInvites.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [fullInvites, search]);

  // ✅ Resend Invite
  const handleSendInvite = async (item: ManageInviteItems) => {
    const members = [{
      department: item.specializeId,
      role: item.role,
      email: item.email,
      invitedBy: item.invitedBy,
      name: item.name
    }];
    try {
      const response = await postData("/fhir/v1/invite", members);
      if (response.status === 200) {
        const { message }: any = response.data;
        Swal.fire({
          icon: "success",
          title: "Success",
          text: message || "Invitation resent successfully!"
        });
        await getInvites(); // Refresh list
      }
    } catch (error: any) {
      let errorMessage = "Failed to send invitation.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      Swal.fire({ icon: "error", title: "Error", text: errorMessage });
    }
  };

  // Remove Invites Function

  const RemoveInvites = async (item: any) => {

    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "This will remove the invite permanently.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
      });

      if (result.isConfirmed) {
        const response = await deleteData(`/fhir/v1/removeInvites?email=${item.email}`);

        if (response.status === 200) {
          Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'The invite has been removed.',
            timer: 2000,
            showConfirmButton: false,
          });
          await getInvites();
        }
      }
    } catch (error) {
      console.error("Error removing invite:", error);
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: 'Could not remove invite. Please try again later.',
      });
    }
  };


  useEffect(() => {
    const getDepartmentForSearch = async () => {
      try {
        const response = await getData(`/fhir/v1/getDepartmentForInvite?userId=${userId}`,);
        if (response.status === 200) {
          const data = response.data as { data: any[] };
          // console.log("Fetched departments:", data.data);
          const departments = convertFromFhirDepartment(data.data).map((dept: any) => ({
            value: dept._id,
            label: toTitleCase(dept.name)
          }));
          setDepartmentOptions([{ value: "", label: "All" }, ...departments]);
        } else {
          Swal.fire({ icon: "error", title: "Error", text: "Failed to fetch departments." });
        }
      } catch (error) {
        let errorMessage = "Failed to fetch departments.";
        if (error && typeof error === "object" && "response" in error) {
          const res = (error as any).response;
          errorMessage = res?.data?.message || errorMessage;
        }
        Swal.fire({ icon: "error", title: "Error", text: errorMessage });
      }
    };
    getDepartmentForSearch()
  }, [userId])
  // ✅ Table Columns (inside to access functions)
  const columns = [
    {
      label: "Name",
      key: "name",
      render: (item: ManageInviteItems) => <p>{item.name}</p>,
    },
    {
      label: "Specialization",
      key: "specialize",
      render: (item: ManageInviteItems) => <p>{item.specialize}</p>,
    },
    {
      label: "Email Address",
      key: "email",
      render: (item: ManageInviteItems) => <p>{item.email}</p>,
    },
    {
      label: "Invited on",
      key: "inviteon",
      render: (item: ManageInviteItems) => <p>{item.inviteon}</p>,
    },
    {
      label: "Invited by",
      key: "inviteby",
      render: (item: ManageInviteItems) => <p>{item.inviteby}</p>,
    },
    {
      label: "Status",
      key: "status",
      render: (item: ManageInviteItems) => (
        <div className="CardilogyStatus">
          {item.status === "pending" ? (
            <h6 className="on-pending">Pending</h6>
          ) : item.status === "accepted" ? (
            <h6 className="Accepted">Accepted</h6>
          ) : item.status === "expired" ? (
            <h6 className="on-expire">Expired</h6>
          ) : (
            <h6 className="circle-btn view">Available</h6>
          )}
        </div>
      ),
    },
    {
      label: "Action",
      key: "action",
      render: (item: ManageInviteItems) => (
        <div className="CardilogyStatus">
          {item.action === "pending" && <Button onClick={() => RemoveInvites(item)}>Remove</Button>}
          {item.action === "expired" && (
            <Button onClick={() => handleSendInvite(item)}>Send Again</Button>
          )}
        </div>
      ),
    }
  ];

  return (
    <>
      <div className="hh">
        <div className="RightTopTbl">
          <Form className="Tblserchdiv">
            <input
              type="search"
              placeholder="Search Team Member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="button"><LuSearch size={20} /></Button>
          </Form>

          <div className="DoctSlect">
            <Dropdown onSelect={(val) => {
              setDepartment(val || "");
              const selected = departmentOptions.find(d => d.value === val);
              setSelectedDepartmentName(selected?.label || "Specialization");
            }}>
              <Dropdown.Toggle id="doctor-dropdown">
                {selectedDepartmentName}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {departmentOptions?.map((dept) => (
                  <Dropdown.Item eventKey={dept.value} key={dept.value}>
                    {dept.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>

          </div>


          <div className="StatusSlect">
            <Dropdown onSelect={(val) => setStatus(val || "")}>
              <Dropdown.Toggle id="status-dropdown" style={{ borderRadius: '25px', border: '1px solid #D9D9D9', background: '#fff', color: '#222', minWidth: '100px', fontWeight: 400 }}>
                {status ? toTitleCase(status) : "Status"}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item eventKey="">All</Dropdown.Item>
                <Dropdown.Item eventKey="pending">Pending</Dropdown.Item>
                <Dropdown.Item eventKey="accepted">Accepted</Dropdown.Item>
                <Dropdown.Item eventKey="expired">Expired</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <GenericTable data={cardiology} columns={columns} bordered={false} />
      </div>
    </>
  );
}

export default ManageInviteTable;