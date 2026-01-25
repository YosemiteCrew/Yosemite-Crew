"use client"
import React from "react";
import GuestHeader from "./GuestHeader/GuestHeader";
import UserHeader from "./UserHeader/UserHeader";

const Header = ({ user = false }: { user?: boolean }) => {
  return (
    <header
      className={`
        flex items-center justify-center w-full
        bg-(--whitebg)
        fixed top-0 left-0 z-997
        lg:relative
        ${
          user
            ? "border-b border-b-card-border"
            : `border-b-2 border-transparent
        [border-image-source:linear-gradient(90deg,rgba(255,255,255,0)_0%,#7d7d7d_50%,rgba(255,255,255,0)_100%)]
        [border-image-slice:1]`
        }
      `}
    >
      {user ? <UserHeader /> : <GuestHeader />}
    </header>
  );
};

export default Header;
