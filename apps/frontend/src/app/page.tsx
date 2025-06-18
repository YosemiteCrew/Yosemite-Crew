'use client';
import React, { useState, useEffect } from 'react';
import Header from "./Components/Header/Header";
import AdminDashboardEmpty from "./Pages/AdminDashboardEmpty/AdminDashboardEmpty";



export default function Home() {

  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // useEffect(() => {
  //   // Read from localStorage on mount
  //   const token = localStorage.getItem("userToken");
  //   setIsLoggedIn(!!token);
  // }, []);

  return (
   <>

  <Header isLoggedIn={isLoggedIn}/>
   <AdminDashboardEmpty/>
   
   </>
  );
}
