import React from 'react';

import { ToastContentProps } from 'react-toastify';
import Close from '../../primitives/Icons/Close';
import { IoAlertCircle } from 'react-icons/io5';

type MsgData = {
  title: string;
  text: string;
};

const ErrorToast = ({ data, closeToast }: ToastContentProps<MsgData>) => {
  return (
    <div className="flex gap-0 justify-between w-full">
      <div className="flex gap-3 items-center">
        <IoAlertCircle size={34} color="#ea3729" />

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

export default ErrorToast;
