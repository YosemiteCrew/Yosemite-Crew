import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

import Footer from "@/app/components/Footer/Footer";

import "./PetOwner.css";

const PetOwner = () => {
  return (
    <>
      <div className="DownlodeBody">
        {/* DownlodeSec */}
        <section className="DownlodeSec">
          <div className="PwtOwnerContainer">
            <div className="Downlode_Data">
              <div className="downlodetext">
                <h1>Your companion’s health, in your hands</h1>
                <p>
                  Manage your companion’s health records, hygiene, dietary
                  plans, and schedule vet appointments - all in one app that
                  connects you with groomers, boarders, sitters, vets, and
                  clinics for dogs, cats, or horses.
                </p>
                <PetDownBtn launched={true} />
              </div>
              <Image
                alt="Pet owner app"
                height={500}
                width={400}
                objectFit="contain"
                src={
                  "https://d2il6osz49gpup.cloudfront.net/pet-parent/petparent.png"
                }
              ></Image>
            </div>
          </div>
        </section>

        <section className="PetToolkitSec">
          <div className="PwtOwnerContainer">
            <div className="ToolkitData">
              <div className="ToolkitHead">
                <h2>Your companion’s all-in-one Toolkit</h2>
              </div>
              <div className="ToolkitCard">
                <div className="CardToolItem">
                  <Icon
                    icon="solar:calendar-mark-bold"
                    width="150"
                    height="150"
                  />
                  <h6>Book and manage appointments</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:library-bold" width="150" height="150" />
                  <h6>Access documents anytime</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:health-bold" width="150" height="150" />
                  <h6>Wellness management</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:bolt-bold" width="150" height="150" />
                  <h6>Medication and health monitoring</h6>
                </div>
                <div className="CardToolItem">
                  <Icon
                    icon="solar:chat-round-like-bold"
                    width="150"
                    height="150"
                  />
                  <h6>Hygiene maintenance and dietary plans</h6>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Paws Sec  */}
        {/* <section className="PawsPraisesSec">
          <div className="PawsHead">
            <h2>Paws & Praises</h2>
          </div>
          <div className="PawsPrasData">
            <div className="BrownDiv">
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/Paws1.png"
                alt="Paws1"
                width={1516}
                height={294}
              />
            </div>
            <div className="PurpleDiv">
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/Paws2.png"
                alt="Paws2"
                width={1516}
                height={234}
              />
            </div>
            <div className="GreenDiv">
              <Image
                aria-hidden
                src="https://d2il6osz49gpup.cloudfront.net/Images/Paws3.png"
                alt="Paws3"
                width={1516}
                height={246}
              />
            </div>
          </div>
        </section> */}

        {/* Glimps Sec  */}
        <section className="GlimpseSec">
          <div className="PwtOwnerContainer">
            <div className="GlimsData">
              <div className="GlimpsHead">
                <h2>Glimpse of paw-sibilities</h2>
              </div>
              <div className="GlimpsImage">
                <Image
                  aria-hidden
                  src="https://d2il6osz49gpup.cloudfront.net/pet-parent/pawsibilities.png"
                  alt="glimpsimg"
                  width={1291}
                  height={917}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pet App Sec  */}
        <section className="PetAppSec">
          <div className="PwtOwnerContainer">
            <div className="PetAppData">
              <div className="LftpetApp">
                <div className="PetAppText">
                  <h2>The only companion app you’ll ever need</h2>
                  <p>
                    Download Yosemite Crew app today and take the first step
                    towards better health for your companions.
                  </p>
                </div>
                <PetDownBtn launched={true} />
              </div>
              <div className="RytpetApp">
                <Image
                  aria-hidden
                  src="https://d2il6osz49gpup.cloudfront.net/Images/petapppic.png"
                  alt="petapppic"
                  width={569}
                  height={569}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
};

export default PetOwner;

interface PetDownBtnProps {
  launched?: boolean;
}
const PetDownBtn = ({ launched = false }: Readonly<PetDownBtnProps>) => {
  if (!launched) {
    return (
      <div className="ComingSoonBtn">
        <Icon
          icon={"solar:star-bold"}
          width="18"
          height="18"
          color="#fff"
          className="ComingSoonStar"
        />
        <h3>Coming Soon</h3>
      </div>
    );
  }

  return (
    <div className="PetAppBtn">
      <Link href="#">
        <Icon icon="basil:apple-solid" width="29" height="29" />
        <div>
          <p>Download on the</p>
          <h6>App Store</h6>
        </div>
      </Link>
      <Link href="#">
        <Icon icon="ion:logo-google-playstore" width="29" height="29" />
        <div>
          <p>Get it on</p>
          <h6>Google Play</h6>
        </div>
      </Link>
    </div>
  );
};

export { PetDownBtn };
