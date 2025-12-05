import { Secondary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

const Delete = () => {
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
        <button
          onClick={() => setDeletePopup(true)}
          className="px-8! py-3! rounded-2xl! hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition duration-300 bg-[#EA3729] font-grotesk font-medium text-white text-[18px]!"
        >
          Delete organization
        </button>
      </div>
      {deletePopup && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] sm:w-[500px] z-10 bg-white py-6! sm:py-8! px-4! sm:px-5! flex flex-col gap-3 sm:gap-6 rounded-3xl shadow-[0_0_32px_0_rgba(0,0,0,0.32)]">
          <div className="flex w-full items-center justify-between">
            <button className="opacity-0">
              <IoIosCloseCircleOutline size={28} color="#302f2e" />
            </button>
            <div className="font-grotesk font-medium text-[23px] text-black-text">
              Delete organization
            </div>
            <button onClick={() => setDeletePopup(false)}>
              <IoIosCloseCircleOutline size={28} color="#302f2e" />
            </button>
          </div>
          <div className="font-satoshi text-black-text font-semibold text-[18px]">
            Are you sure you want to delete this organization?
          </div>
          <div className="font-satoshi text-black-text font-semibold text-[18px]">
            <div>This action will permanently remove:</div>
            <ul className="list-disc">
              <li>All organization settings</li>
              <li>Rooms, teams, users & roles</li>
              <li>Appointments, tasks & history</li>
              <li>Inventory, finance & documents</li>
              <li>Companions/pet records</li>
              <li>Subscription & billing data</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-satoshi text-black-text font-semibold text-[18px]">
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
              className="font-satoshi text-black-text font-semibold text-[16px]"
            >
              I understand that all data will be permanently deleted.
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Secondary href="#" text="Cancel" onClick={() => handleCancel()} />
            <button
              onClick={() => handleDelete()}
              className="px-8! py-3! rounded-2xl! hover:shadow-[0_0_32px_0_rgba(0,0,0,0.32)] transition duration-300 bg-[#EA3729] font-grotesk font-medium text-white text-[18px]!"
            >
              Delete
            </button>
          </div>
          <div className="font-satoshi text-grey-noti font-semibold text-[15px]">
            <span className="text-blue-text">Note : </span> Deleting the
            organization will remove all data and cannot be reversed.
          </div>
        </div>
      )}
    </>
  );
};

export default Delete;
