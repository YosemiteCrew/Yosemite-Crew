import React from "react";
import { IoIosClose } from "react-icons/io";

const Close = ({ onClick }: { onClick?: () => void }) => {
  return (
    <button
      className="flex items-center justify-center rounded-full! hover:bg-card-hover! p-2 transition-all duration-300 ease-in-out"
      onClick={onClick}
    >
      <IoIosClose size={28} color="#302f2e" className="cursor-pointer" />
    </button>
  );
};

export default Close;
