import React from "react";
import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section
      className="HeroSection"
      style={{
        "--background-image": `url(${import.meta.env.VITE_BASE_IMAGE_URL}/heroafter.png)`,
      }}
    >
      <div className="container">
        <div className="HeroData">
          <div className="LeftHeroDiv">
            <div className="herotext">
              <h1 className="type first">Helping You Help Pets,</h1>
              <h1>
                <span className="type second">Without the Hassle</span>
              </h1>
            </div>

            <div className="heroPara">
              <div className="paraitem">
                <p>
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/P1.png`}
                    alt="Hero"
                  />
                  Open source, cloud-based system
                </p>
              </div>
              <div className="paraitem">
                <p>
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/P2.png`}
                    alt="Hero"
                  />
                  Enhance your daily workflow
                </p>
              </div>
              <div className="paraitem">
                <p>
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/P3.png`}
                    alt="Hero"
                  />
                  Easy-to-use, time-saving features
                </p>
              </div>
              <div className="paraitem">
                <p>
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/P4.png`}
                    alt="Hero"
                  />
                  Access data anytime, anywhere
                </p>
              </div>
            </div>

            <div className="HeroBtn">
              <Link className="Fillbtn" to="/signup">
                <i className="ri-flashlight-fill"></i> Get Started
              </Link>
              <Link className="Sbtn" to="/contact">
                <i className="ri-time-fill"></i> Book a Demo
              </Link>
            </div>
          </div>

          <div className="RytHeroDiv">
            <img
              src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Heroimg.png`}
              alt="Hero"
            />
          </div>
        </div>
      </div>
    </section>
  );
}