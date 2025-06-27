'use client';
import React, { useState } from 'react';
import Header from "./Components/Header/Header";
import HomePage from './Pages/HomePage/HomePage';




export default function Home() {

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // useEffect(() => {
  //   // Read from localStorage on mount
  //   const token = localStorage.getItem("userToken");
  //   setIsLoggedIn(!!token);
  // }, []);

  return (
   <>

  <Header isLoggedIn={isLoggedIn}/>

  <HomePage/>

   
   </>
  );
}
