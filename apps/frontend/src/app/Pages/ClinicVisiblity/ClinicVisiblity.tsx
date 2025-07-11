'use client';
import React  from 'react'
import "./ClinicVisiblity.css"
import { Container } from 'react-bootstrap'
import Image from 'next/image'
import { IoLocationSharp } from 'react-icons/io5';
import { FaGlobe, FaLocationArrow, FaStar } from 'react-icons/fa6';
import Link from 'next/link';
import { RiEditLine } from 'react-icons/ri';
import { FaPhoneAlt } from 'react-icons/fa';
import { HeadText } from '../CompleteProfile/CompleteProfile';
import { IoMdEye } from 'react-icons/io';
import ImageGallery from '@/app/Components/ImageGallery/ImageGallery';
import AddServices from '@/app/Components/Services/AddServices/AddServices';
import Department from '@/app/Components/Services/Department/Department';
import { MainBtn } from '../Sign/SignUp';
import { GoCheckCircleFill } from 'react-icons/go';

function ClinicVisiblity() {

  return (
    <>

    <section className="ClinicVisibleSec">
        <Container>

            <div className="ClinicVisiblityData">

                <div className="TopClinicProf">
                    <div className="clincprofText">
                        <HeadText blktext="Profile Visibility" Spntext="Clinic’s" spanFirst />
                        <p>Manage the visibility of your clinic&apos;s departments, doctors, and services. Choose what to showcase to ensure a tailored experience for your clients.</p>
                    </div>
                    <div className="ClinicVisiblBtn">
                        <Link href="" ><IoMdEye /> Manage Clinic Visibility</Link>
                    </div>
                </div>

            
                <div className="ClicVisibleData">

                    <div className="LeftvisibleDiv">

                        <div className="TopVisibleItems">

                            <div className="clicprofdiv">
                                <Image aria-hidden  src={`${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/pft.png`} alt="eyes" width={150} height={150} />
                                <div className="ClVDiv">
                                    <div className="clpfname">
                                        <div className="texted">
                                            <h4>San Francisco Animal Medical Center</h4>
                                            <p>PMS ID: SFAMCYC2025</p>
                                            <div className="loct">
                                                <span><IoLocationSharp/> 2.5mi</span>
                                                <span><FaStar/> 4.1</span>
                                            </div>
                                        </div>
                                        <div className="opencl">
                                            <span>Open</span>
                                            <p>Open 24 Hours</p>
                                        </div>
                                    </div>
                                    <ComnBtn CompText="Edit Details" CompIcon={<RiEditLine />} />
                                </div>
                            </div>

                            <AddServices/>
                            <Department/>
                        </div>

                        <MainBtn btnicon={<GoCheckCircleFill />} btnname="Update Visibility" iconPosition="left"  />



                    </div>

                    <div className="RytvisibleDiv">
                        <div className="clinicContDetail">
                            <h5>Contact Information</h5>
                            <div className="Cont-info">
                                <Link href="#"><FaPhoneAlt /> +1 415-872-1872</Link>
                                <Link href="#"><FaGlobe /> sfamc.com</Link>
                                <Link href="#"><FaLocationArrow /> 2343 Fillmore St San Francisco, CA 94115 </Link>
                            </div>
                        </div>

                        <ImageGallery/>
                        
                    </div>







                </div>

            </div>




        </Container>
    </section>








    </>
  )
}

export default ClinicVisiblity



type ComnBtnProps = {
  CompText: string;
  CompIcon?: React.ReactNode;
}

export function ComnBtn({ CompText, CompIcon }: ComnBtnProps) {
  return (
    <div className="CommonBtn">
      <Link href="#">
        {CompIcon} {CompText}
      </Link>
    </div>
  );
}
