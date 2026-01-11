import React from "react";
import { IoChevronForward } from "react-icons/io5";

const Next = ({ onClick }: { onClick: any }) => {
  return (
    <button
      className="flex items-center justify-center rounded-full! hover:bg-card-hover! p-2 transition-all duration-300 ease-in-out"
      onClick={onClick}
    >
      <IoChevronForward size={20} color="#302f2e" className="cursor-pointer" />
    </button>
  );
};

export default Next;
