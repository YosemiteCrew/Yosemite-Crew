import React from "react";

import { ToastContentProps } from "react-toastify";
import { IoIosInformationCircle } from "react-icons/io";
import { Close } from "../../primitives/Icons";

type MsgData = {
  title: string;
  text: string;
};

const Info = ({ data, closeToast }: ToastContentProps<MsgData>) => {
  return (
    <div className="flex gap-0 justify-between w-full">
      <div className="flex gap-3 items-center">
        <IoIosInformationCircle size={34} color="#247aed" />
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

export default Info;
