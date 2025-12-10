import SubLabels from "@/app/components/Labels/SubLabels";
import Modal from "@/app/components/Modal";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import Details from "./Details";
import Build from "./Build";
import Review from "./Review";
import { FormsCategory, FormsProps } from "@/app/types/forms";
import {
  publishForm,
  saveFormDraft,
} from "@/app/services/formService";

const Labels = [
  {
    name: "Form details",
    key: "form-details",
  },
  {
    name: "Build form",
    key: "build-form",
  },
  {
    name: "Review",
    key: "review",
  },
];

type AddFormProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  initialForm?: FormsProps | null;
  onClose?: () => void;
  serviceOptions: { label: string; value: string }[];
  draft?: FormsProps | null;
  onDraftChange?: (draft: FormsProps | null) => void;
};

const defaultForm = (): FormsProps => ({
  name: "",
  category: "" as FormsCategory,
  usage: "Internal",
  updatedBy: "",
  lastUpdated: "",
  status: "Draft",
  schema: [],
});

const AddForm = ({
  showModal,
  setShowModal,
  initialForm,
  onClose,
  serviceOptions,
  draft,
  onDraftChange,
}: AddFormProps) => {
  const [activeLabel, setActiveLabel] = useState("form-details");
  const [formData, setFormData] = useState<FormsProps>(
    draft ?? initialForm ?? defaultForm()
  );
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenRef = useRef(false);

  const isEditing = useMemo(
    () => Boolean(initialForm?._id),
    [initialForm]
  );

  useEffect(() => {
    if (showModal && !wasOpenRef.current) {
      setActiveLabel("form-details");
      const next = initialForm ?? draft ?? defaultForm();
      setFormData(next);
      wasOpenRef.current = true;
    }
    if (!showModal) {
      wasOpenRef.current = false;
    }
  }, [showModal, initialForm, draft]);

  useEffect(() => {
    if (!initialForm) {
      onDraftChange?.(formData);
    }
  }, [formData, onDraftChange, initialForm]);

  const closeModal = () => {
    setFormData(defaultForm());
    setActiveLabel("form-details");
    onDraftChange?.(null);
    setActiveLabel("form-details");
    setShowModal(false);
    onClose?.();
  };

  const goToNextStep = () => {
    if (activeLabel === "form-details") setActiveLabel("build-form");
    else if (activeLabel === "build-form") setActiveLabel("review");
  };

  const handleClear = () => {
    const cleared = initialForm ?? defaultForm();
    setFormData(cleared);
    setActiveLabel("form-details");
    onDraftChange?.(cleared);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const saved = await saveFormDraft({
        ...formData,
        status: "Draft",
      });
      setFormData(saved);
      onDraftChange?.(null);
      setFormData(defaultForm());
      setActiveLabel("form-details");
      closeModal();
    } catch (err) {
      console.error("Failed to save draft", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const saved = await saveFormDraft(formData);
      if (saved._id) {
        await publishForm(saved._id);
        setFormData({ ...saved, status: "Published" });
      }
      onDraftChange?.(null);
      setFormData(defaultForm());
      setActiveLabel("form-details");
      closeModal();
    } catch (err) {
      console.error("Failed to publish form", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} onClose={onClose}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <div className="w-16" />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            {isEditing ? "Edit form" : "Add form"}
          </div>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-satoshi font-semibold text-grey-noti underline decoration-1 underline-offset-4"
              >
                Clear
              </button>
            )}
            <IoIosCloseCircleOutline
              size={28}
              color="#302f2e"
              onClick={closeModal}
              className="cursor-pointer"
            />
          </div>
        </div>

        <SubLabels
          labels={Labels}
          activeLabel={activeLabel}
          setActiveLabel={setActiveLabel}
        />

        <div className="flex overflow-y-auto flex-1">
          {activeLabel === "form-details" && (
            <Details
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
            />
          )}
          {activeLabel === "build-form" && (
            <Build
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
            />
          )}
          {activeLabel === "review" && (
            <Review
              formData={formData}
              onPublish={handlePublish}
              onSaveDraft={handleSaveDraft}
              serviceOptions={serviceOptions}
              loading={isSaving}
              isEditing={isEditing}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddForm;
