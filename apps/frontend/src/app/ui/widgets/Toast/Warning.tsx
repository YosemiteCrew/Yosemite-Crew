import React from "react";

import { ToastContentProps } from "react-toastify";
import { Close } from "../../primitives/Icons";
import { IoIosWarning } from "react-icons/io";

type MsgData = {
  title: string;
  text: string;
};

const Warning = ({ data, closeToast }: ToastContentProps<MsgData>) => {
  return (
    <div className="flex gap-0 justify-between w-full">
      <div className="flex gap-3 items-center">
        <IoIosWarning size={34} color="#f68523" />
        <div className="flex flex-col gap-0">
          <div className="text-body-3 text-text-primary">{data.title}</div>
          <div className="text-body-4 text-text-tertiary">{data.text}</div>
        </div>
      </div>
      <div className="">
        <Close onClick={closeToast} />
      </div>
    </div>
  );
};

export default Warning;
