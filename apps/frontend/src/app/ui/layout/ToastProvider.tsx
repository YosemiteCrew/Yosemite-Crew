"use client";

import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/ReactToastify.css";

const ToastProvider = () => {
  return (
    <ToastContainer transition={Slide} limit={5} />
  );
};

export default ToastProvider;
