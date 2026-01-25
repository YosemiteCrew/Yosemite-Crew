import Modal from "@/app/components/Modal";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Details from "./Details";
import Build from "./Build";
import Review from "./Review";
import { FormsCategory, FormsProps } from "@/app/types/forms";
import { publishForm, saveFormDraft } from "@/app/services/formService";
import Close from "@/app/components/Icons/Close";
import Labels from "@/app/components/Labels/Labels";
import { useOrgStore } from "@/app/stores/orgStore";

const LabelOptions = [
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

const defaultForm = (): FormsProps => {
  const primaryOrg = useOrgStore.getState().getPrimaryOrg?.();
  return {
    name: "",
    category: "" as FormsCategory,
    usage: "Internal",
    updatedBy: "",
    lastUpdated: "",
    status: "Draft",
    schema: [],
    businessType: primaryOrg?.type,
  };
};

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const detailValidatorRef = useRef<() => boolean>(() => true);
  const buildValidatorRef = useRef<() => boolean>(() => true);
  const [isSaving, setIsSaving] = useState(false);
  const wasOpenRef = useRef(false);

  const isEditing = useMemo(() => Boolean(initialForm?._id), [initialForm]);

  useEffect(() => {
    if (showModal && !wasOpenRef.current) {
      setActiveLabel("form-details");
      const next = {
        ...(initialForm ?? draft ?? defaultForm()),
        businessType: initialForm?.businessType ?? draft?.businessType ?? useOrgStore.getState().getPrimaryOrg?.()?.type,
      };
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
    if (activeLabel === "form-details") {
      if (!detailValidatorRef.current()) return;
      setActiveLabel("build-form");
    } else if (activeLabel === "build-form") {
      if (!buildValidatorRef.current()) return;
      setActiveLabel("review");
    }
  };

  const handleLabelClick = (target: string) => {
    if (target === activeLabel) return;
    const order = ["form-details", "build-form", "review"] as const;
    const currentIndex = order.indexOf(activeLabel as any);
    const targetIndex = order.indexOf(target as any);
    if (currentIndex === -1 || targetIndex === -1) {
      setActiveLabel(target);
      return;
    }

    if (targetIndex > currentIndex) {
      for (let i = 0; i < targetIndex; i++) {
        if (order[i] === "form-details" && !detailValidatorRef.current())
          return;
        if (order[i] === "build-form" && !buildValidatorRef.current()) return;
      }
    }
    setActiveLabel(target);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLabel]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal} onClose={onClose}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">
              {isEditing ? "Edit form" : "Add form"}
            </div>
          </div>
          <Close onClick={closeModal} />
        </div>

        <Labels
          labels={LabelOptions}
          activeLabel={activeLabel}
          setActiveLabel={handleLabelClick}
        />

        <div
          ref={scrollRef}
          className="flex overflow-y-auto flex-1 scrollbar-hidden"
        >
          {activeLabel === "form-details" && (
            <Details
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              registerValidator={(fn) => {
                detailValidatorRef.current = fn;
              }}
            />
          )}
          {activeLabel === "build-form" && (
            <Build
              formData={formData}
              setFormData={setFormData}
              onNext={goToNextStep}
              serviceOptions={serviceOptions}
              registerValidator={(fn) => {
                buildValidatorRef.current = fn;
              }}
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
