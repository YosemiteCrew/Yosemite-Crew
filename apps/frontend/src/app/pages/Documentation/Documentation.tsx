"use client";

import React, { useState, useEffect } from "react";
import SidebarMenu from "./SidebarMenu/SidebarMenu";
import MainContent from "./MainContent/MainContent";
import Footer from "@/app/components/Footer/Footer";
import { Container } from "react-bootstrap";
import "./Documentation.css";

function Documentation() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 1200);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <>
      <section className="Documentation">
        <Container className="container">
          {!isMobile && <SidebarMenu />}
          <MainContent isMobile={isMobile} />
        </Container>
      </section>
      <Footer />
    </>
  );
}

export default Documentation;
