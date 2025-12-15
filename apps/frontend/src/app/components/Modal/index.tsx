import React, { useRef, useEffect } from "react";

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
};

const Modal = ({ children, showModal, setShowModal, onClose }: ModalProps) => {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowModal(false);
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModal, onClose, setShowModal]);

  return (
    <div
      ref={popupRef}
      className={`fixed top-20 right-0 h-[calc(100%-80px)] w-full sm:w-[450px] bg-white border! border-grey-light! shadow-[0_0_16px_0_rgba(0,0,0,0.16)] rounded-l-2xl z-50 transition-transform duration-300 ease-in-out ${
        showModal ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {children}
    </div>
  );
};

export default Modal;
