
import React from "react";
import "./Footer.css";
// import FtLogo from "../../../../public/Images/Logo.png";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    
      <footer className="Footersec"
      style={{
        "--background-image": `url(${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Foot.png)`
      }}
      >
        <div className="container">
          <div className="FootTopData">
            <div className="leftFooter">
              <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Logo.png`} alt="footerlogo" />
            </div>
            <div className="RytFooter">
              <div className="FtDiv">
                <h5>Developers</h5>
                <div className="FtLinks">
                  <Link to="#">Getting Started</Link>
                  <Link to="#">Documentation</Link>
                  <Link to="#">Search</Link>
                </div>
              </div>
              <div className="FtDiv">
                <h5>Community</h5>
                <div className="FtLinks">
                  <Link to="#">Case Studies</Link>
                  <Link to="#">Discord</Link>
                  <Link to="#">Storybook</Link>
                  <Link to="#">GitHub</Link>
                  <Link to="#">Contributing</Link>
                </div>
              </div>
              <div className="FtDiv">
                <h5>Company</h5>
                <div className="FtLinks">
                  <Link to="#">About us</Link>
                  <Link to="#">Security</Link>
                  <Link to="#">Terms of Service</Link>
                  <Link to="#">Privacy Policy</Link>
                  <Link to="#">Pricing</Link>
                  <Link to="#">Enterprise</Link>
                  <Link to="#">Careers</Link>
                  <Link to="#">Blog</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="Footer_Bottom">
            <div className="Bootom_Foot">
              <h4>Copyright &copy; DuneXploration UG</h4>
              <p>
                DuneXploration UG (haftungsbeschränkt) <br /> Mainzer Strasse
                397, 55411 Bingen am Rhein{" "}
              </p>
            </div>
          </div>
        </div>
      </footer>

  );
};

export default Footer;
