import React from "react";
import { IoIosClose } from "react-icons/io";

type CloseProps = {
  onClick?: () => void;
  iconOnly?: boolean;
};

const Close = ({ onClick, iconOnly = false }: CloseProps) => {
  if (iconOnly) {
    return <IoIosClose size={28} color="#302f2e" className="cursor-pointer" />;
  }

  return (
    <button
      type="button"
      className="flex items-center justify-center rounded-full! hover:bg-card-hover! p-2 transition-all duration-300 ease-in-out"
      onClick={onClick}
    >
      <IoIosClose size={28} color="#302f2e" className="cursor-pointer" />
    </button>
  );
};

export default Close;
