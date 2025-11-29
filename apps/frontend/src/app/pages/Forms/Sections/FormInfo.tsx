import Modal from "@/app/components/Modal";
import { FormsProps } from "@/app/types/forms";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type FormInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeForm: FormsProps | null;
};

const FormInfo = ({ showModal, setShowModal, activeForm }: FormInfoProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View form
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>
      </div>
    </Modal>
  );
};

export default FormInfo;
