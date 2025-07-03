'use client';
import React, { useEffect, useState } from 'react';
import Header from "./Components/Header/Header";
import HomePage from './Pages/HomePage/HomePage';
import { useAuth } from './Context/AuthContext';




export default function Home() {
  const {tokens} = useAuth()
  const [isLoggedIn, setIsLoggedIn] = useState(true);
 console.log("token",tokens)
  useEffect(() => {   
    setIsLoggedIn(!!tokens);
  }, [tokens]);

  return (
   <>

  <Header isLoggedIn={isLoggedIn}/>

  <HomePage/>

   
   </>
  );
}
