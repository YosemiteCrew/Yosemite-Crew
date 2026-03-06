import React from "react";
import { IoChevronBack } from "react-icons/io5";

const Back = ({
  onClick,
  className,
  disabled = false,
}: {
  onClick: any;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <button
      className={`${className} flex items-center justify-center rounded-full! hover:bg-card-hover! p-2 transition-all duration-300 ease-in-out`}
      onClick={onClick}
      disabled={disabled}
    >
      <IoChevronBack size={20} color="#302f2e" />
    </button>
  );
};

export default Back;
