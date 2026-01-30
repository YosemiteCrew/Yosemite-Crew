import React from "react";
import { IoIosWarning } from "react-icons/io";

type BookingErrorMessageProps = {
  error?: string;
};

const BookingErrorMessage = ({ error }: BookingErrorMessageProps) => {
  if (!error) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1 px-2 text-caption-2 text-text-error">
      <IoIosWarning className="text-text-error" size={14} />
      <span>{error}</span>
    </div>
  );
};

export default BookingErrorMessage;
