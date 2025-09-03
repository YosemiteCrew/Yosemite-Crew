"use client";
import React, { useState } from "react";
import "./Github.css";
import { IoCloseSharp } from "react-icons/io5";
import { FaGithub } from "react-icons/fa6";
import { Icon } from "@iconify/react/dist/iconify.js";

interface GithubProps {
  isOpen: boolean;
  onClose: () => void;
}

const Github = ({isOpen, onClose}: GithubProps) => {

  if (!isOpen) return null;

  return (
    <div className="GithubWrapper">
      <div className="GithubMain">
        <div className="GithubTitle">Star us on Github</div>
        <a href="https://github.com/YosemiteCrew/Yosemite-Crew" target="_blank" className="GithubStar">
          <div className="Title"> 
            <Icon icon="mdi:github" width="28" height="28" color="#302F2E" /> 
            <p>Star</p>
          </div>
          <div className="Line"></div>
          <h6 className="Stars">2403</h6>
        </a>
        <div className="CloseButton" onClick={onClose}>
          <IoCloseSharp color="#fff" size={20} />
        </div>
      </div>
    </div>
  );
};

export default Github;
