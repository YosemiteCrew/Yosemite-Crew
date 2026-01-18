import { Secondary } from "@/app/components/Buttons";
import Delete from "@/app/components/Buttons/Delete";
import Close from "@/app/components/Icons/Close";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import CenterModal from "@/app/components/Modal/CenterModal";
import { deleteOrg } from "@/app/services/orgService";
import React, { useState } from "react";

const DeleteOrg = () => {
  const [deletePopup, setDeletePopup] = useState(false);
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleCancel = () => {
    setDeletePopup(false);
    setEmail("");
    setConsent(false);
    setEmailError("");
  };
  const handleDelete = async () => {
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    try {
      await deleteOrg();
      setDeletePopup(false);
      setEmail("");
      setConsent(false);
      setEmailError("");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Delete
          href="#"
          onClick={() => setDeletePopup(true)}
          text="Delete organization"
        />
      </div>
      <CenterModal
        showModal={deletePopup}
        setShowModal={setDeletePopup}
        onClose={handleCancel}
      >
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">
              Delete organization
            </div>
          </div>
          <Close onClick={handleCancel} />
        </div>
        <div className="flex flex-col gap-0">
          <div className="text-body-4 text-text-primary">
            Are you sure you want to delete this organization?
          </div>
          <div className="text-body-4 text-text-primary">
            <div className="">This action will permanently remove:</div>
            <ul className="mb-0 list-disc text-caption-1 text-text-primary">
              <li>All organization settings</li>
              <li>Rooms, teams, users & roles</li>
              <li>Appointments, tasks & history</li>
              <li>Inventory, finance & documents</li>
              <li>Companions/pet records</li>
              <li>Subscription & billing data</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-body-4 text-text-primary">
            This cannot be undone. Enter owner email address
          </div>
          <FormInput
            intype="text"
            inname="email"
            value={email}
            inlabel="Enter email address"
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              placeholder="Demo"
              id="consent-checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label
              htmlFor="consent-checkbox"
              className="text-body-4 text-text-primary"
            >
              I understand that all data will be permanently deleted.
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Secondary href="#" text="Cancel" onClick={() => handleCancel()} />
            <Delete href="#" onClick={() => handleDelete()} text="Delete" />
          </div>
          <div className="text-caption-1 text-text-primary">
            <span className="text-blue-text">Note : </span> Deleting the
            organization will remove all data and cannot be reversed.
          </div>
        </div>
      </CenterModal>
    </>
  );
};

export default DeleteOrg;
