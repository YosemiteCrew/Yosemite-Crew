"use client";

import React from "react";
import Cookies from "../Cookies/Cookies";
import Github from "../Github/Github";
import Header from "../Header/Header";

export default function PublicShell({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <Cookies />
      <Github />
      <Header />
      <div className="pt-20 flex-1 lg:pt-0">{children}</div>
    </>
  );
}
