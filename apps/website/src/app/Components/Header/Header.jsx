
import React, {useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; 
import "./Header.css"
// import Logo from "../../../../public/Images/Logo.png"
// import pfpic from "../../../../public/Images/pft.png"

const Header = () => {
  
  const location = useLocation(); // Get the current location

  useEffect(() => {
    const toggleScrolled = () => {
      const selectBody = document.querySelector('body');
      const selectHeader = document.querySelector('#header');
      if (
        !selectHeader.classList.contains('scroll-up-sticky') &&
        !selectHeader.classList.contains('sticky-top') &&
        !selectHeader.classList.contains('fixed-top')
      )
        return;
      window.scrollY > 100
        ? selectBody.classList.add('scrolled')
        : selectBody.classList.remove('scrolled');
    };

    const handleNavClick = () => {
      // Toggle mobile nav if active
      if (document.querySelector('.mobile-nav-active')) {
        toggleMobileNav();
      }
    };

    const toggleMobileNav = () => {
      document.querySelector('body').classList.toggle('mobile-nav-active');
      const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
      mobileNavToggleBtn.classList.toggle('ri-bar-chart-horizontal-line');
      mobileNavToggleBtn.classList.toggle('ri-close-line');
    };

    const handleDropdownClick = (event) => {
      event.preventDefault();
      const target = event.currentTarget;
      target.parentNode.classList.toggle('active');
      target.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      event.stopImmediatePropagation();
    };

    // Set active class based on the current path
    document.querySelectorAll('#navmenu a').forEach((link) => {
      if (link.getAttribute('href') === location.pathname) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Event listeners
    window.addEventListener('scroll', toggleScrolled);
    window.addEventListener('load', toggleScrolled);

    const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
    if (mobileNavToggleBtn) {
      mobileNavToggleBtn.addEventListener('click', toggleMobileNav);
    }

    document.querySelectorAll('#navmenu a').forEach((navmenu) =>
      navmenu.addEventListener('click', handleNavClick)
    );

    document.querySelectorAll('.navmenu .toggle-dropdown').forEach((dropdown) =>
      dropdown.addEventListener('click', handleDropdownClick)
    );

    return () => {
      window.removeEventListener('scroll', toggleScrolled);
      window.removeEventListener('load', toggleScrolled);
      if (mobileNavToggleBtn) {
        mobileNavToggleBtn.removeEventListener('click', toggleMobileNav);
      }
      document.querySelectorAll('#navmenu a').forEach((navmenu) =>
        navmenu.removeEventListener('click', handleNavClick)
      );
      document
        .querySelectorAll('.navmenu .toggle-dropdown')
        .forEach((dropdown) =>
          dropdown.removeEventListener('click', handleDropdownClick)
        );
    };
  }, [location.pathname]); // Dependency on the current path



  // Profile Pic 
  // This state simulates whether the user is logged in or not.
  // Replace this with your actual authentication logic.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Example: Check if user is logged in based on a token from local storage
  useEffect(() => {
    const token = localStorage.getItem('userToken');
    setIsLoggedIn(!!token); // If there's a token, the user is logged in
    console.log('Is Logged In:', !!token); // Log the result
  }, []);



  return (
    <>
    
    {/* <header id="header" className="header d-flex align-items-center fixed-top"> */}
    <header id="header" className="header d-flex align-items-center ">
      <div className="container-fluid container-xl position-relative d-flex align-items-center justify-content-between">
        <a href="/"  className="logo d-flex align-items-center me-auto me-lg-0">
        <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Logo.png`} alt="" />
           
        </a>
        <nav id="navmenu" className="navmenu">
          <ul>
            <li><a href="/dashboard" className="active">Home</a></li>
            <li><a href="/department">Specialities</a></li>
            <li><a href="/addoctor">Doctors</a></li>
            <li><a href="/appointment">Appointments</a></li>
            <li><a href="/AssessmentManagement">Assessments</a></li>
            {/* <li className="dropdown">
              <a href="#"><span>Dropdown</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
              <ul>
                <li><a href="#">Dropdown 1</a></li>
                <li className="dropdown">
                  <a href="#"><span>Deep Dropdown</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
                  <ul>
                    <li><a href="#">Deep Dropdown 1</a></li>
                    <li><a href="#">Deep Dropdown 2</a></li>
                    <li><a href="#">Deep Dropdown 3</a></li>
                    <li><a href="#">Deep Dropdown 4</a></li>
                    <li><a href="#">Deep Dropdown 5</a></li>
                  </ul>
                </li>
                <li><a href="#">Dropdown 2</a></li>
                <li><a href="#">Dropdown 3</a></li>
                <li><a href="#">Dropdown 4</a></li>
              </ul>
            </li> */}
            <li><a href="/contact">Contact us</a></li>
          </ul>
          <i className="mobile-nav-toggle d-xl-none ri-bar-chart-horizontal-line"></i>
        </nav>
        
        <div className="headerbtn">
          {!isLoggedIn ? (
            // Show the "Get Started" button if the user is not logged in
            <a className="btn-getstarted" href="/signup">Get Started</a>
          ) : (
            // Show the profile div if the user is logged in
            <div className="HeaderProfDiv">
              <ul className="NavUL">
                <li className="nav-item dropdown">
                  <a     href="/#"
                    className="nav-profile d-flex align-items-center"
                
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pft.png`} alt="Profile" />
                    <p className="">
                      San Francisco Animal <br /> Medical Center
                    </p>
                    <span className="d-none d-md-block dropdown-toggle"></span>
                  </a>
                  <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow profileUl">
                    <li className="dropdown-header">
                      <h6>Kevin Anderson</h6>
                      <span>Web Designer</span>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>

                    <li>
                      <a className="dropdown-item d-flex align-items-center" href="/#">
                        <i className="ri-user-fill"></i>
                        <span>My Profile</span>
                      </a>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>

                    <li>
                      <a className="dropdown-item d-flex align-items-center" href="/#">
                        <i className="ri-settings-2-line"></i>
                        <span>Account Settings</span>
                      </a>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>

                    <li>
                      <a className="dropdown-item d-flex align-items-center" href="/#">
                        <i className="ri-question-line"></i>
                        <span>Need Help?</span>
                      </a>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>

                    <li>
                      <a className="dropdown-item d-flex align-items-center" href="/signup">
                        <i className="ri-logout-box-r-line"></i>
                        <span>Sign Out</span>
                      </a>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          )}
        </div>
        
      </div>
    </header>






    </>
  )
}

export default Header