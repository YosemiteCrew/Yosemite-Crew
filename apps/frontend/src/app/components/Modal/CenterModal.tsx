import React, { useRef, useEffect } from "react";

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
};

const CenterModal = ({
  children,
  showModal,
  setShowModal,
  onClose,
}: ModalProps) => {
  const popupRef = useRef<HTMLDivElement | null>(null);

  const closeModal = () => {
    setShowModal(false);
    onClose?.();
  };

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
    <>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close modal"
        className={`fixed backdrop-blur-[2px] inset-0 bg-[#302f2e80] z-1100 transition-opacity duration-200 ease-in-out ${
          showModal ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeModal}
      />

      {/* Modal */}
      <div
        ref={popupRef}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 transition-opacity duration-100 ease-out -translate-y-1/2 w-[90%] sm:w-[500px] z-1200 bg-white py-3 px-3 flex flex-col gap-3 rounded-2xl border border-card-border ${
          showModal ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {children}
      </div>
    </>
  );
};

export default CenterModal;
