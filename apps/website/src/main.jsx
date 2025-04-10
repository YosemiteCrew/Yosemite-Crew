// import { StrictMode } from "react";
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import 'remixicon/fonts/remixicon.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'sweetalert2/dist/sweetalert2.min.css';
// slick slide
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { AuthProvider } from './context/AuthContext.jsx';
const baseImageUrl = import.meta.env.VITE_BASE_IMAGE_URL || "";
const favicon = document.getElementById("dynamic-favicon");
if (favicon && baseImageUrl) {
  favicon.href = `${baseImageUrl}/favicon.png`;
}
createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
