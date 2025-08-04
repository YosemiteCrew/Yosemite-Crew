// InviteTeamMembers.tsx
"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Button, Container, Form, Modal } from "react-bootstrap";
import { PiFileArrowDownFill } from "react-icons/pi";
import { IoIosArrowDropleft } from "react-icons/io";
import { FaCircleCheck } from "react-icons/fa6";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import { FormInput } from "../Sign/SignUp";
import { IoAddCircle } from "react-icons/io5";
import { MdDeleteForever } from "react-icons/md";
import { RiUploadCloud2Fill } from "react-icons/ri";
import { LiaTimesCircle } from "react-icons/lia";
import { HiDocumentArrowDown } from "react-icons/hi2";
import { getData, postData } from "@/app/axios-services/services";
import Swal from "sweetalert2";
// import { useAuth } from "@/app/Context/AuthContext";
import "./InviteTeamMembers.css";
import { useAuthStore } from "@/app/stores/authStore";
import { convertFromFhirDepartment } from "@yosemite-crew/fhir";
// Bulk Invite Modal Component
type Member = {
  name: string;
  email: string;
  role: string;
  department: string;
  invitedBy: string;
};

function BulkInviteModal({
  show,
  onHide,
  onDataParsed,
  departmentOptions,
}: {
  show: boolean;
  onHide: () => void;
  onDataParsed: (data: Member[]) => void;
  departmentOptions: { label: string; value: string }[];
}) {
  const parseCsv = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1);

    return rows.map((row) => {
      const values = row.split(",").map((v) => v.trim());
      const record: any = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx];
      });
      return {
        name: record.name || "",
        email: record.email || "",
        role: record.role || "",
        department:
          departmentOptions.find(
            (opt) =>
              opt.label.toLowerCase() === (record.department || "").toLowerCase()
          )?.value || "", // Map department label to ID
        invitedBy: "",
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedData = parseCsv(content);
      onDataParsed(parsedData);
      onHide();
    };
    reader.readAsText(file);
  };

  return (
    <Modal show={show} onHide={onHide} centered className="BulkInviteModalSec">
      <Modal.Body>
        <div className="BulkInviteBody">
          <div className="BulkHeader">
            <h3>Bulk Invite Team Members</h3>
            <p>Upload a CSV with name, email, role and department</p>
          </div>

          <div className="BulkMidContent">
            <div className="Step1">
              <div className="Step1Hed">
                <h6>Step 01</h6>
                <Form.Check type="checkbox" />
              </div>
              <div className="StepDownlde">
                <div className="lftText">
                  <h4>Download the sample CSV</h4>
                  <p>Add your team data as shown in the format</p>
                </div>
                <div className="RytDoct">
                  <a href="/InviteMembers.csv" download className="DownloadIcon">
                    <HiDocumentArrowDown size={32} />
                  </a>
                </div>
              </div>
            </div>

            <div className="Step2">
              <div className="Step2Hed">
                <h6>Step 02</h6>
              </div>
              <div className="StepUplode">
                <label htmlFor="csvUpload" className="UplodeInner">
                  <RiUploadCloud2Fill size={40} />
                  <h4>Upload the CSV</h4>
                  <p>Max size: 20MB</p>
                </label>
                <input
                  type="file"
                  id="csvUpload"
                  accept=".csv"
                  hidden
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </div>

          <div className="UpldBtn">
            <Button onClick={onHide}>Done</Button>
          </div>
          <div className="CrossBtn">
            <Button variant="light" onClick={onHide}>
              <LiaTimesCircle size={28} />
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}


function InviteTeamMembers() {
  const { userId } = useAuthStore();
  const [modalShow, setModalShow] = useState(false);
  const [errors, setErrors] = useState<Record<number, Partial<Record<keyof typeof members[0], string>>>>({});
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);


 
  const validateMembers = () => {
    const newErrors: typeof errors = {};

    members.forEach((member, idx) => {
      const memberErrors: Partial<Record<keyof typeof member, string>> = {};

      if (!member.name.trim()) memberErrors.name = "Name is required.";
      if (!member.department) memberErrors.department = "Department is required.";
      if (!member.role) memberErrors.role = "Role is required.";
      if (!member.email.trim()) {
        memberErrors.email = "Email is required.";
      } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(member.email)) {
        memberErrors.email = "Invalid email format.";
      }

      if (Object.keys(memberErrors).length > 0) {
        newErrors[idx] = memberErrors;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [members, setMembers] = useState([
    { department: "", role: "", email: "", invitedBy: "", name: "" }
  ]);
 console.log("InviteTeamMembers rendered with userId:", members);

  const handleMemberChange = useCallback((index: number, field: "department" | "role" | "email" | "name", value: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }, []);

  const addMember = () => {
    setMembers((prev) => [...prev, { department: "", role: "", email: "", invitedBy: userId || "", name: "" }]);
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendInvite = async () => {
    if (!validateMembers()) {
      return;
    }

    const membersWithInviter = members.map(member => ({
      ...member,
      invitedBy: member.invitedBy || userId || ""
    }));

    try {
      const response = await postData("/fhir/v1/invite", membersWithInviter);
      if (response.status === 200) {
        const data = response.data as { message?: string };
        Swal.fire({ icon: "success", title: "Success", text: data.message || "Invitations sent successfully!" });
        setMembers([{ department: "", role: "", email: "", name: "", invitedBy: userId || "" }]);
        setErrors({}); // reset errors
      }
    } catch (error: unknown) {
      let errorMessage = "Failed to send invitations.";
      if (error && typeof error === "object" && "response" in error) {
        const res = (error as any).response;
        errorMessage = res?.data?.message || errorMessage;
      }
      Swal.fire({ icon: "error", title: "Error", text: errorMessage });
    }
  };


  useEffect(() => {
    const getDepartmentForInvite = async () => {
    try {
      const response = await getData(`/fhir/v1/getDepartmentForInvite?userId=${userId}`,);
      if (response.status === 200) {
        const data = response.data as { data: any[] };
        // console.log("Fetched departments:", data.data);
        const departments = convertFromFhirDepartment(data.data).map((dept: any) => ({
          value: dept._id,
          label: dept.departmentName
        }));
        setDepartmentOptions(departments);
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
    getDepartmentForInvite();
  }, [userId]);


  const roleOptions = [
    { value: "Veterinarian", label: "Vet" },
    { value: "Vet Assistant", label: "Vet Assistant" },
    { value: "Receptionist", label: "Receptionist" },
    { value: "Nurse", label: "Nurse" },
    { value: "Vet Technician", label: "Vet Technician" },
  ];

  return (
    <>
      <section className="PracticeTeamSec">
        <Container>
          <div className="PracticeTeamData">
            <div className="InviteContainer">
              <div className="InviteHeader">
                <h4>Invite <span>team member</span></h4>
                <Button className="ImportBtn" onClick={() => setModalShow(true)}>
                  <PiFileArrowDownFill /> Bulk Invite
                </Button>
              </div>

              <BulkInviteModal
              show={modalShow}
              onHide={() => setModalShow(false)}
              departmentOptions={departmentOptions}
              onDataParsed={(parsed) => {
                const withUser = parsed.map((p) => ({
                  ...p,
                  invitedBy: userId || "",
                }));
                setMembers(withUser);
              }}
            />

              <div className="InviteCard">
                <div className="InviteTeamData">
                  {members.map((member, idx) => (
                    <div key={idx} className="MemberFormBlock">
                      <div className="InviteTitleTrash">
                        <h2>{members.length > 1 ? (<><span className="member-number">{(idx + 1).toString().padStart(2, "0")}</span>. Add Member Details</>) : "Add Details"}</h2>
                        {members.length > 1 && (
                          <Button variant="link" className="RemoveBtn" onClick={() => removeMember(idx)}>
                            <MdDeleteForever />
                          </Button>
                        )}
                      </div>
                      <div className="w-100">
                        <FormInput
                          intype="string"
                          inname="name"
                          value={member.name}
                          inlabel="Name"
                          onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                          error={errors[idx]?.name}
                        />
                      </div>
                      <DynamicSelect
                        options={departmentOptions}
                        value={member.department}
                        onChange={(val: string) => handleMemberChange(idx, "department", val)}
                        inname="department"
                        placeholder="Department"
                        error={errors[idx]?.department}
                      />
                      <DynamicSelect
                        options={roleOptions}
                        value={member.role}
                        onChange={(val: string) => handleMemberChange(idx, "role", val)}
                        inname="role"
                        placeholder="Select Role"
                        error={errors[idx]?.role}
                      />
                      <div className="w-100">
                        <FormInput
                          intype="email"
                          inname="email"
                          value={member.email}
                          inlabel="Email Address"
                          onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                          error={errors[idx]?.email}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="AddMemberDiv">
                    <Button onClick={addMember}><IoAddCircle /> Add More Members</Button>
                    {members.length > 1 && <p>Inviting more than 10 members? <span>Use the Bulk Invite Option.</span></p>}
                  </div>
                </div>
                <div className="InviteFooter">
                  <Button className="BackBtn"><IoIosArrowDropleft /> Back</Button>
                  <Button className="SendBtn" onClick={handleSendInvite}><FaCircleCheck /> Send Invite</Button>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

export default InviteTeamMembers;