import React from "react";
import { IoEye } from "react-icons/io5";
import { IoIosCalendar } from "react-icons/io";

export type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

export const NoDataMessage = () => (
  <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
    No data available
  </div>
);

type ActionButtonProps = {
  onClick: () => void;
};

export const ViewButton = ({ onClick }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
  >
    <IoEye size={18} color="#302F2E" />
  </button>
);

export const RescheduleButton = ({ onClick }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
  >
    <IoIosCalendar size={18} color="#302F2E" />
  </button>
);

export const ProfileTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="appointment-profile-title">{children}</div>
);

export const ProfileSubtitle = ({ children }: { children: React.ReactNode }) => (
  <div className="appointment-profile-sub truncate">{children}</div>
);
