import { Secondary } from "@/app/components/Buttons";
import Delete from "@/app/components/Buttons/Delete";
import Close from "@/app/components/Icons/Close";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import CenterModal from "@/app/components/Modal/CenterModal";
import React, { useState } from "react";

const DeleteProfile = () => {
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
  const handleDelete = () => {
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    setDeletePopup(false);
    setEmail("");
    setConsent(false);
    setEmailError("");
  };

  return (
    <>
      <div className="flex justify-center">
        <Delete
          href="#"
          onClick={() => setDeletePopup(true)}
          text="Delete profile"
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
            <div className="text-body-1 text-text-primary">Delete profile</div>
          </div>
          <Close onClick={handleCancel} />
        </div>
        <div className="flex flex-col gap-0">
          <div className="text-body-4 text-text-primary">
            Are you sure you want to delete your profile?
          </div>
          <div className="text-body-4 text-text-primary">
            <div>This action will permanently remove:</div>
            <ul className="mb-0 list-disc text-caption-1 text-text-primary">
              <li>Personal details</li>
              <li>Professional information</li>
              <li>Availability & schedule</li>
              <li>Assigned tasks & appointment history</li>
              <li>Access permissions within all organizations</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-body-4 text-text-primary">
            This cannot be undone. Enter your email address
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
              className="shrink-0"
            />
            <label
              htmlFor="consent-checkbox"
              className="text-body-4 text-text-primary"
            >
              I understand that all profile data will be permanently deleted.
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Cancel" onClick={() => handleCancel()} />
            <Delete href="#" onClick={() => handleDelete()} text="Delete" />
          </div>
          <div className="text-caption-1 text-text-primary">
            <span className="text-blue-text">Note : </span> Deleting the profile
            will remove all data and cannot be reversed.
          </div>
        </div>
      </CenterModal>
    </>
  );
};

export default DeleteProfile;
