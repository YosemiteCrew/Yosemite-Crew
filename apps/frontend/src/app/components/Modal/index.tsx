import React, { useRef, useEffect } from "react";

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
};

const Modal = ({ children, showModal, setShowModal, onClose }: ModalProps) => {
  const popupRef = useRef<HTMLDivElement | null>(null);

  const closeModal = () => {
    setShowModal(false);
    onClose?.();
  };

  useEffect(() => {
    if (!showModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Ignore clicks that occur inside the signing overlay so it does not close the parent modal
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-signing-overlay='true']")) return;

      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowModal(false);
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModal, onClose, setShowModal]);

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close modal"
        className={`fixed backdrop-blur-[2px] inset-0 bg-[#302f2e80] z-1100 transition-opacity duration-300 ease-in-out ${
          showModal ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeModal}
      />

      {/* Modal */}
      <div
        ref={popupRef}
        className={`fixed top-0 right-0 bottom-0 m-3 p-3 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[530px]
        bg-white border border-card-border rounded-2xl z-1200
        transition-transform duration-300 ease-in-out
        ${showModal ? "translate-x-0" : "translate-x-[120%]"}`}
      >
        {children}
      </div>
    </>
  );
};

export default Modal;
