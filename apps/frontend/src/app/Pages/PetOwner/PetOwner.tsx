import React from "react";
import { Container } from "react-bootstrap";
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
          <Container>
            <div className="Downlode_Data">
              <div className="downlodetext">
                <h1>
                  Your Pet’s Health, <br /> <span>in Your Hands</span>
                </h1>
                <p>
                  Manage your pet’s health, schedule vet appointments, set
                  reminders, and more—all in one app.
                </p>
                <PetDownBtn />
              </div>
            </div>
          </Container>
        </section>

        <section className="PetToolkitSec">
          <Container>
            <div className="ToolkitData">
              <div className="ToolkitHead">
                <h2>Your Pet’s All-in-One Toolkit</h2>
              </div>
              <div className="ToolkitCard">
                <div className="CardToolItem">
                  <Icon
                    icon="solar:calendar-mark-bold"
                    width="150"
                    height="150"
                  />
                  <h6>Book and Manage Vet Appointments</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:library-bold" width="150" height="150" />
                  <h6>Access Medical Records Anytime</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:health-bold" width="150" height="150" />
                  <h6>Wellness Management</h6>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:bolt-bold" width="150" height="150" />
                  <h6>Medication and Health Monitoring</h6>
                </div>
                <div className="CardToolItem">
                  <Icon
                    icon="solar:chat-round-like-bold"
                    width="150"
                    height="150"
                  />
                  <h6>Medication and Health Monitoring</h6>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Paws Sec  */}
        <section className="PawsPraisesSec">
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
        </section>

        {/* Glimps Sec  */}
        <section className="GlimpseSec">
          <Container>
            <div className="GlimsData">
              <div className="GlimpsHead">
                <h2>A Glimpse of Paw-sibilities</h2>
              </div>
              <div className="GlimpsImage">
                <Image
                  aria-hidden
                  src="https://d2il6osz49gpup.cloudfront.net/Images/glimpsimg.png"
                  alt="glimpsimg"
                  width={1291}
                  height={917}
                />
              </div>
            </div>
          </Container>
        </section>

        {/* Pet App Sec  */}
        <section className="PetAppSec">
          <Container>
            <div className="PetAppData">
              <div className="LftpetApp">
                <div className="PetAppText">
                  <h2>
                    The Only Pet App <br /> <span>You’ll Ever Need</span>
                  </h2>
                  <p>
                    Download Yosemite Crew App today and take the first step
                    towards better health for your furry friends.
                  </p>
                </div>
                <PetDownBtn />
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
          </Container>
        </section>
      </div>

      <Footer />
    </>
  );
}

export default PetOwner;

interface PetDownBtnProps {
  launched?: boolean;
}
export function PetDownBtn({ launched = false }: Readonly<PetDownBtnProps>) {
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
        <span>
          <p>Download on the</p>
          <h6>App Store</h6>
        </span>
      </Link>
      <Link href="#">
        <Icon icon="ion:logo-google-playstore" width="29" height="29" />
        <span>
          <p>Get it on</p>
          <h6>Google Play</h6>
        </span>
      </Link>
    </div>
  );
}
