"use client";
import React, { useEffect } from "react";

import Header from "./Header/Header";
import Cookies from "./Cookies/Cookies";
import Github from "./Github/Github";
import { useAuthStore } from "../stores/authStore";

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    const initSession = async () => {
      await checkSession();
    };
    initSession();
  }, [checkSession]);

  return (
    <>
      <Header />
      <Cookies />
      <Github />
      <div className="bodywrapper">{children}</div>
    </>
  );
};

export default SessionInitializer;
