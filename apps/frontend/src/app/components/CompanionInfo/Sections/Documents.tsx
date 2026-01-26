import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Fallback from "@/app/components/Fallback";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import React, { useEffect, useMemo, useState } from "react";
import { IoIosWarning } from "react-icons/io";
import {
  Category,
  CategoryOptions,
  CompanionRecord,
  emptyCompanionRecord,
  HealthCategoryOptions,
  HygieneCategoryOptions,
  Subcategory,
} from "@/app/types/companionDocuments";
import {
  createCompanionDocument,
  loadCompanionDocument,
  loadDocumentDownloadURL,
} from "@/app/services/companionDocumentService";
import { CompanionParent } from "@/app/pages/Companions/types";
import { toTitle } from "@/app/utils/validators";
import { formatDateLabel } from "@/app/utils/forms";
import CompanionDoc from "../../UploadImage/CompanionDoc";

type DocumentsType = {
  companion: CompanionParent;
};

const Documents = ({ companion }: DocumentsType) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] =
    useState<CompanionRecord>(emptyCompanionRecord);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    category?: string;
    sub?: string;
    fileUrl?: string;
  }>({});

  const companionID = useMemo(() => {
    return companion.companion.id;
  }, [companion]);

  const [records, setRecords] = useState<CompanionRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!companionID) {
        setRecords([]);
        return;
      }
      try {
        const data = await loadCompanionDocument(companionID);
        if (!cancelled) setRecords(data ?? []);
      } catch {
        if (!cancelled) setRecords([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [companionID]);

  const handleSave = async () => {
    const errors: { title?: string; fileUrl?: string } = {};
    if (!formData.title) errors.title = "Name is required";
    if (formData.attachments.length <= 0) errors.fileUrl = "File is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createCompanionDocument(formData, companionID);
      await loadCompanionDocument(companionID);
      setFormData(emptyCompanionRecord);
      setFormDataErrors({});
      setFile(null);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = async (id: string | undefined) => {
    try {
      const data = await loadDocumentDownloadURL(id);
      if (data.length > 0) {
        const docURL = data[0].url;
        window.open(docURL, "_blank");
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <PermissionGate
      allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 overflow-y-auto scrollbar-hidden">
        <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
          <Accordion
            title="Upload records"
            defaultOpen={false}
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <LabelDropdown
                placeholder="Category"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    category: option.value as Category,
                  })
                }
                defaultOption={formData.category}
                options={CategoryOptions}
                error={formDataErrors.category}
              />
              <LabelDropdown
                placeholder="Sub-category"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    subcategory: option.value as Subcategory,
                  })
                }
                defaultOption={formData.subcategory}
                options={
                  formData.category === "HEALTH"
                    ? HealthCategoryOptions
                    : HygieneCategoryOptions
                }
                error={formDataErrors.sub}
              />
              <FormInput
                intype="text"
                inname="name"
                value={formData.title}
                inlabel="Title"
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                error={formDataErrors.name}
              />
              <CompanionDoc
                placeholder="Upload document"
                apiUrl={`/v1/document/pms/upload-url`}
                companionId={companionID}
                onChange={(s) =>
                  setFormData({ ...formData, attachments: [{ key: s }] })
                }
                file={file}
                setFile={setFile}
                error={formDataErrors.fileUrl}
              />
              {formDataErrors.fileUrl && (
                <div
                  className={`
                    mt-1.5 flex items-center gap-1 px-4
                    text-caption-2 text-text-error
                  `}
                >
                  <IoIosWarning className="text-text-error" size={14} />
                  <span>{formDataErrors.fileUrl}</span>
                </div>
              )}
              <Primary href="#" text="Save" onClick={handleSave} />
            </div>
          </Accordion>
        </PermissionGate>
        <div className="w-full">
          {records.length === 0 ? (
            <div className="flex items-center justify-center text-body-4 text-text-primary">
              No documents found
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((doc) => (
                <div
                  key={doc.id}
                  className="w-full rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer"
                >
                  <div className="text-body-3-emphasis text-text-primary">
                    {doc.title}
                  </div>
                  <div className="flex gap-1">
                    <div className="text-caption-1 text-text-extra">
                      Category:
                    </div>
                    <div className="text-caption-1 text-text-primary">
                      {toTitle(doc.category)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="text-caption-1 text-text-extra">
                      Sub-category:
                    </div>
                    <div className="text-caption-1 text-text-primary">
                      {toTitle(doc.subcategory)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="text-caption-1 text-text-extra">Visit:</div>
                    <div className="text-caption-1 text-text-primary">
                      {toTitle(doc.visitType)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="text-caption-1 text-text-extra">Date:</div>
                    <div className="text-caption-1 text-text-primary">
                      {formatDateLabel(doc.issueDate)}
                    </div>
                  </div>
                  <div className="flex gap-3 w-full">
                    <Secondary
                      href="#"
                      onClick={() => handleDownload(doc.id)}
                      text="Download"
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PermissionGate>
  );
};

export default Documents;
