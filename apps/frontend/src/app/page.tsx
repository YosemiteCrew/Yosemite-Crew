'use client';
import React, { useState } from 'react';
import Header from "./Components/Header/Header";
import MainLandingPage from './Pages/MainLandingPage/MainLandingPage';



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
   {/* <AdminDashboardEmpty/> */}
   <MainLandingPage/>
   
   </>
  );
}
