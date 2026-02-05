import { Secondary } from "@/app/ui/primitives/Buttons";
import Delete from "@/app/ui/primitives/Buttons/Delete";
import FormInput from "@/app/ui/inputs/FormInput/FormInput";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import ModalHeader from "@/app/ui/overlays/Modal/ModalHeader";
import React, { useState, useCallback } from "react";

type DeleteConfirmationModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  confirmationQuestion: string;
  itemsToRemove: string[];
  emailPrompt: string;
  consentLabel: string;
  noteText: string;
  onDelete: () => Promise<void>;
};

export const useDeleteConfirmation = () => {
  const [showModal, setShowModal] = useState(false);
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const reset = useCallback(() => {
    setShowModal(false);
    setEmail("");
    setConsent(false);
    setEmailError("");
  }, []);

  const validateEmail = useCallback(() => {
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    return true;
  }, [email]);

  return {
    showModal,
    setShowModal,
    consent,
    setConsent,
    email,
    setEmail,
    emailError,
    setEmailError,
    reset,
    validateEmail,
  };
};

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  showModal,
  setShowModal,
  title,
  confirmationQuestion,
  itemsToRemove,
  emailPrompt,
  consentLabel,
  noteText,
  onDelete,
}) => {
  const {
    consent,
    setConsent,
    email,
    setEmail,
    emailError,
    reset,
    validateEmail,
  } = useDeleteConfirmation();

  const handleCancel = () => {
    reset();
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!validateEmail()) return;
    try {
      await onDelete();
      reset();
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <CenterModal
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={handleCancel}
    >
      <ModalHeader title={title} onClose={handleCancel} />
      <div className="flex flex-col gap-0">
        <div className="text-body-4 text-text-primary">{confirmationQuestion}</div>
        <div className="text-body-4 text-text-primary">
          <div>This action will permanently remove:</div>
          <ul className="mb-0 list-disc text-caption-1 text-text-primary">
            {itemsToRemove.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-body-4 text-text-primary">{emailPrompt}</div>
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
            {consentLabel}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Secondary href="#" text="Cancel" onClick={handleCancel} />
          <Delete href="#" onClick={handleDelete} text="Delete" />
        </div>
        <div className="text-caption-1 text-text-primary">
          <span className="text-blue-text">Note : </span> {noteText}
        </div>
      </div>
    </CenterModal>
  );
};

export default DeleteConfirmationModal;
