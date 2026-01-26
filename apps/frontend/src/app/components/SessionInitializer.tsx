"use client";
import React, { useEffect } from "react";

import Header from "./Header/Header";
import { useAuthStore } from "../stores/authStore";
import Sidebar from "./Sidebar/Sidebar";
import "@stripe/connect-js";

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void useAuthStore.getState().checkSession();
  }, []);

  const isChecking = status === "idle" || status === "checking";

  return (
    <div className="flex h-screen flex-1 lg:overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <Header user />

        <div className="pt-20 flex-1 lg:pt-0 lg:overflow-y-scroll">
          {isChecking ? null : children}
        </div>
      </div>
    </div>
  );
};

export default SessionInitializer;
