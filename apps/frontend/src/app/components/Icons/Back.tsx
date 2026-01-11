import React from "react";
import { IoChevronBack } from "react-icons/io5";

const Back = ({ onClick }: { onClick: any }) => {
  return (
    <button
      className="flex items-center justify-center rounded-full! hover:bg-card-hover! p-2 transition-all duration-300 ease-in-out"
      onClick={onClick}
    >
      <IoChevronBack size={20} color="#302f2e" className="cursor-pointer" />
    </button>
  );
};

export default Back;
