import React from 'react';

import { ToastContentProps } from 'react-toastify';
import { IoCheckmarkCircle } from 'react-icons/io5';
import Close from '../../primitives/Icons/Close';

type MsgData = {
  title: string;
  text: string;
};

const Success = ({ data, closeToast }: ToastContentProps<MsgData>) => {
  return (
    <div className="flex gap-0 justify-between w-full">
      <div className="flex gap-3 items-center">
        <IoCheckmarkCircle size={34} color="#008f5d" />
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

export default Success;
