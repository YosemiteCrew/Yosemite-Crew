import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import UploadImage from "@/app/components/UploadImage/UploadImage";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type AddDocumentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddDocument = ({ showModal, setShowModal }: AddDocumentProps) => {
  const [formData, setFormData] = useState<any>({
    title: "",
    description: "",
  });
  const [formDataErrors] = useState<{
    title?: string;
  }>({});

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add document
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between">
          <Accordion
            title="Add room"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <FormInput
                intype="text"
                inname="title"
                value={formData.title}
                inlabel="Document title"
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                error={formDataErrors.title}
                className="min-h-12!"
              />
              <FormDesc
                intype="text"
                inname="description"
                value={formData.description}
                inlabel="Description"
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[120px]!"
              />
              <UploadImage placeholder="Upload documents" />
            </div>
          </Accordion>
          <Primary
            href="#"
            text="Save"
            classname="max-h-12! text-lg! tracking-wide!"
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddDocument;
