'use client';

import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * The single runtime toast host. Position, stacking and timing live here so
 * every `useNotify` call site shares them; the surface itself is the
 * `.Toastify__toast` recipe in globals.css and the body is `NotifyToast`.
 * The library's own close button, icon and progress bar are switched off
 * because the body draws its own tone disc and the shared Close control.
 */
const ToastProvider = () => (
  <ToastContainer
    position="top-right"
    transition={Slide}
    limit={5}
    newestOnTop
    autoClose={5000}
    closeButton={false}
    icon={false}
    hideProgressBar
    closeOnClick={false}
    draggable={false}
    pauseOnHover
    pauseOnFocusLoss
    toastClassName="yc-toast"
    className="yc-toast-container"
  />
);

export default ToastProvider;
