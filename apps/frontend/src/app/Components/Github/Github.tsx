"use client";
import React, { useState } from "react";
import "./Github.css";
import { IoCloseSharp } from "react-icons/io5";
import { FaGithub } from "react-icons/fa6";

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
            <FaGithub size={26} /> <div>Star</div>
          </div>
          <div className="Line"></div>
          <div className="Stars">2403</div>
        </a>
        <div className="CloseButton" onClick={onClose}>
          <IoCloseSharp color="#fff" size={20} />
        </div>
      </div>
    </div>
  );
};

export default Github;
