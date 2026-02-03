import React, { useEffect, useRef } from "react";

type ModalBaseProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  overlayClassName: string;
  containerClassName: string;
  ignoreOutsideClick?: (target: HTMLElement | null) => boolean;
};

const ModalBase = ({
  children,
  showModal,
  setShowModal,
  onClose,
  overlayClassName,
  containerClassName,
  ignoreOutsideClick,
}: ModalBaseProps) => {
  const popupRef = useRef<HTMLDivElement | null>(null);

  const closeModal = () => {
    setShowModal(false);
    onClose?.();
  };

  useEffect(() => {
    if (!showModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (ignoreOutsideClick?.(target)) return;
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowModal(false);
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModal, onClose, setShowModal, ignoreOutsideClick]);

  return (
    <>
      <button
        type="button"
        aria-label="Close modal"
        className={overlayClassName}
        onClick={closeModal}
      />

      <div ref={popupRef} className={containerClassName}>
        {children}
      </div>
    </>
  );
};

export default ModalBase;
