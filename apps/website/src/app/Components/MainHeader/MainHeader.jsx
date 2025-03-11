// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import './MainHeader.css';
import Logo from '../../../../public/Images/Logo.png';
import Chatt from '../../../../public/Images/chatt.png';
import { IoIosArrowDown } from 'react-icons/io';
import { FaGithub } from 'react-icons/fa6';

import { Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/useAuth';

const MainHeader = ({ isMainHeader }) => {
  const { profileData, onLogout, userType } = useAuth();
  const navigate = useNavigate();

  const [profileDataa, setupProfileData] = useState([]);

  useEffect(() => {
    setupProfileData(profileData);
  }, [profileData]);
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

    document
      .querySelectorAll('#navmenu a')
      .forEach((navmenu) => navmenu.addEventListener('click', handleNavClick));

    document
      .querySelectorAll('.navmenu .toggle-dropdown')
      .forEach((dropdown) =>
        dropdown.addEventListener('click', handleDropdownClick)
      );

    return () => {
      window.removeEventListener('scroll', toggleScrolled);
      window.removeEventListener('load', toggleScrolled);
      if (mobileNavToggleBtn) {
        mobileNavToggleBtn.removeEventListener('click', toggleMobileNav);
      }
      document
        .querySelectorAll('#navmenu a')
        .forEach((navmenu) =>
          navmenu.removeEventListener('click', handleNavClick)
        );
      document
        .querySelectorAll('.navmenu .toggle-dropdown')
        .forEach((dropdown) =>
          dropdown.removeEventListener('click', handleDropdownClick)
        );
    };
  }, [location.pathname]); // Dependency on the current path

  // do not touch

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  // Close mobile nav when clicking outside or navigating
  useEffect(() => {
    if (isMobileNavOpen) {
      const handleOutsideClick = () => setIsMobileNavOpen(false);
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [isMobileNavOpen]);

  const handleLogout = async () => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will be logged out!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, log out!',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(
            `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/signOut`,
            {
              method: 'POST',
              // credentials: "include", // Include cookies in the request
            }
          );
          if (response.ok) {
            // Navigate to the Signin page
            Swal.fire(
              'Logged Out!',
              'You have been logged out successfully.',
              'success'
            );
            onLogout(navigate);
          } else {
            console.error('Failed to logout');
            Swal.fire(
              'Error!',
              'There was an issue logging you out. Please try again.',
              'error'
            );
          }
        } catch (error) {
          console.error('Error during logout:', error);
          Swal.fire(
            'Error!',
            'An unexpected error occurred. Please try again later.',
            'error'
          );
        }
      }
    });
  };

  return (
    <header id="header" className="header d-flex align-items-center ">
      <div className="container-fluid container-xl position-relative d-flex align-items-center justify-content-between">
        <Link to="/" className="logo d-flex align-items-center ">
          <img src={Logo} alt="" />
        </Link>

        {/* Navigation Links */}
        <nav id="navmenu" className="navmenu">
          {isMainHeader ? (
            <ul>
              <li>
                <Link to="/dashboard" className="active">
                  Home
                </Link>
              </li>
              {userType === 'Hospital'||userType === 'Groomer Shop' ? (
                <li>
                  <Link to="/checkin">Waiting Room</Link>
                </li>
              ) : null}
              {profileDataa?.activeModes === 'yes' ? (
                <li>
                  <Link to="/department">Specialities</Link>
                </li>
              ) : null}

              {userType === 'Hospital' ||userType === 'Groomer Shop'? (
                <li>
                  <Link to="/addoctor">Doctors</Link>
                </li>
              ) : null}
              <li>
                <Link to="/appointment">Appointments</Link>
              </li>
              <li>
                <Link to="/AssessmentManagement">Assessments</Link>
              </li>
              {userType === 'Hospital'||userType === 'Groomer Shop' ? (
                <li>
                  <Link to="/inventory">Inventory</Link>
                </li>
              ) : null}

              <li>
                <Link to="/lblogpage">Blog</Link>
              </li>
            </ul>
          ) : (
            <ul>
              <li>
                <Link to="/" className="active">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/downlodeapp">Pet App</Link>
              </li>
              <li>
                <Link to="/homepage">PMS</Link>
              </li>
              <li className="dropdown">
                <Link to="/DeveloperLandingPage">
                  <span>Developer Home</span> <IoIosArrowDown />
                </Link>
                {/* <ul>
                    <li>
                      <Link to="#">Dropdown 1</Link>
                    </li>
                    <li>
                      <Link to="#">Dropdown 2</Link>
                    </li>
                    <li>
                      <Link to="#">Dropdown 3</Link>
                    </li>
                    <li>
                      <Link to="#">Dropdown 4</Link>
                    </li>
                  </ul> */}
              </li>
              <li>
                <Link to="/blogpage">Blogs</Link>
              </li>
              <li>
                <Link to="/aboutus">About Us</Link>
              </li>
              <li>
                <Link to="/contact">Contact Us</Link>
              </li>
            </ul>
          )}
        </nav>

        {/* User Actions */}
        <div className="user_actions">
          {isMainHeader ? (
            <>
              <div className="chatbtn">
                <Link to="/chatscreen">
                  <img src={Chatt} alt="ChatNotification" /> <span>5</span>
                </Link>
              </div>

              <div className="HeaderProfDiv">
                <ul className="NavUL">
                  <li className="nav-item dropdown">
                    <Link
                      className="nav-profile d-flex align-items-center"
                      to="#"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <img src={profileDataa?.logoUrl} alt="Profile" />
                      <p>
                        {profileDataa?.businessName.length > 21 ? (
                          <>
                            <div>{profileDataa?.businessName.slice(0, 21)}</div>
                            <div>{profileDataa?.businessName.slice(21)}</div>
                          </>
                        ) : (
                          <div>{profileDataa?.businessName}</div>
                        )}
                      </p>
                      <span className="d-none d-md-block dropdown-toggle"></span>
                    </Link>
                    <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow profileUl">
                      <li className="dropdown-header">
                        <h6>Kevin Anderson</h6>
                        <span>Web Designer</span>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      <li>
                        <Link
                          className="dropdown-item d-flex align-items-center"
                          to={
                            userType === 'Doctor'
                              ? '/doctorprofile'
                              : '/clinicvisible'
                          }
                        >
                          <i className="ri-user-fill"></i>
                          <span>My Profile</span>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      <li>
                        <Link
                          className="dropdown-item d-flex align-items-center"
                          to="#"
                        >
                          <i className="ri-settings-2-line"></i>
                          <span>Account Settings</span>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      <li>
                        <Link
                          className="dropdown-item d-flex align-items-center"
                          to="#"
                        >
                          <i className="ri-question-line"></i>
                          <span>Need Help?</span>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      <li>
                        <Button
                          className="dropdown-item d-flex align-items-center"
                          onClick={() => handleLogout()}
                        >
                          <i className="ri-logout-box-r-line"></i>
                          <span>Sign Out</span>
                        </Button>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="gitbtn">
              <Link to="#">
                <span>
                  <FaGithub />
                </span>
                Star us on GitHub
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Nav Toggle Button */}
        <i className="mobile-nav-toggle d-xl-none ri-bar-chart-horizontal-line"></i>
      </div>
    </header>
  );
};

// Add PropTypes validation
MainHeader.propTypes = {
  isMainHeader: PropTypes.bool.isRequired,
};

export default MainHeader;
