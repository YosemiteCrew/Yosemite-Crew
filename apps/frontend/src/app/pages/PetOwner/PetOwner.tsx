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
                <div className="text-display-1 text-text-primary">Your companion&rsquo;s health, in your hands</div>
                <div className="text-body-3 text-text-primary">
                  Manage your companion&rsquo;s health records, hygiene, dietary
                  plans, and schedule vet appointments - all in one app that
                  connects you with groomers, boarders, sitters, vets, and
                  clinics for dogs, cats, or horses.
                </div>
                <PetDownBtn launched={true} />
              </div>
              <Image
                alt="Pet owner app"
                width={800}
                height={1000}
                quality={100}
                src="https://d2il6osz49gpup.cloudfront.net/pet-parent/petparent.png"
                priority
              />
            </div>
          </div>
        </section>

        <section className="PetToolkitSec">
          <div className="PwtOwnerContainer">
            <div className="ToolkitData">
              <div className="ToolkitHead">
                <div className="text-display-2 text-text-primary">Your companion&rsquo;s all-in-one toolkit</div>
              </div>
              <div className="ToolkitCard">
                <div className="CardToolItem">
                  <Icon
                    icon="solar:calendar-mark-bold"
                    width="150"
                    height="150"
                  />
                  <div className="text-heading-3 text-white">Book and manage appointments</div>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:library-bold" width="150" height="150" />
                  <div className="text-heading-3 text-white">Access documents anytime</div>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:health-bold" width="150" height="150" />
                  <div className="text-heading-3 text-white">Wellness management</div>
                </div>
                <div className="CardToolItem">
                  <Icon icon="solar:bolt-bold" width="150" height="150" />
                  <div className="text-heading-3 text-white">Medication and health monitoring</div>
                </div>
                <div className="CardToolItem">
                  <Icon
                    icon="solar:chat-round-like-bold"
                    width="150"
                    height="150"
                  />
                  <div className="text-heading-3 text-white">Hygiene maintenance and dietary plans</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Paws Sec  */}
        <section className="PawsPraisesSec">
          <div className="flex flex-col gap-4 md:gap-8! xl:gap-12! w-full">
            <div className="PawsHead">
              <div className="text-display-2 text-text-primary">Paws & praises from parents</div>
            </div>
            <div className="w-full flex flex-col gap-6 md:gap-10 xl:gap-16">
              <div className="flex items-center justify-center bg-[#EAF3FF] w-full -rotate-2 BrownDiv">
                <div className="flex gap-2 xl:gap-4 flex-col py-2! md:py-4! pl-16! pr-4! sm:pl-0! sm:pr-0! sm:max-w-[400px] md:max-w-[600px] xl:max-w-[1000px]">
                  <div className="font-satoshi text-black-text text-[1rem] md:text-[1.375rem] xl:text-[2.5rem] font-medium">
                    This app has been a game-changer! I never forget my dog&rsquo;s
                    meds anymore
                  </div>
                  <div className="font-satoshi text-grey-noti text-[0.875rem] md:text-[1rem] xl:text-[1.75rem] font-medium text-right">
                    ~ Germaine, Dog parent
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center bg-[#EAF3FF] w-full rotate-2 PurpleDiv">
                <div className="flex gap-2 xl:gap-4 flex-col py-2! md:py-4! px-10! sm:px-0! sm:max-w-[400px] md:max-w-[600px] xl:max-w-[1000px]">
                  <div className="font-satoshi text-black-text text-[1rem] md:text-[1.375rem] xl:text-[2.5rem] font-medium">
                    Scheduling vet visits has never been this easy. Love it!
                  </div>
                  <div className="font-satoshi text-grey-noti text-[0.875rem] md:text-[1rem] xl:text-[1.75rem] font-medium text-right">
                    ~ Maria, Dog parent
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center bg-[#EAF3FF] w-full -rotate-2 GreenDiv">
                <div className="flex gap-2 xl:gap-4 flex-col py-2! md:py-4! px-10! sm:px-0! sm:max-w-[400px] md:max-w-[600px] xl:max-w-[1000px]">
                  <div className="font-satoshi text-black-text text-[1rem] md:text-[1.375rem] xl:text-[2.5rem] font-medium">
                    Finally, a pet app that understands what we need
                  </div>
                  <div className="font-satoshi text-grey-noti text-[0.875rem] md:text-[1rem] xl:text-[1.75rem] font-medium text-right">
                    ~ Joan, Dog parent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Glimps Sec  */}
        <section className="GlimpseSec">
          <div className="PwtOwnerContainer">
            <div className="GlimsData">
              <div className="GlimpsHead">
                <div className="text-display-2 text-text-primary">Glimpse of paw-sibilities</div>
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
                  <div className="text-display-2 text-text-primary">The only companion app you&rsquo;ll ever need</div>
                  <div className="text-body-4 text-text-primary">
                    Download Yosemite Crew app today and take the first step
                    towards better health for your companions.
                  </div>
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
        <div className="text-body-3-emphasis text-white">Coming Soon</div>
      </div>
    );
  }

  return (
    <div className="PetAppBtn">
      <Link href="https://apps.apple.com/in/app/yosemite-crew/id6756180296">
        <Icon icon="basil:apple-solid" width="29" height="29" />
        <div>
          <div className="app-store-text-small">Download on the</div>
          <div className="app-store-text-large">App Store</div>
        </div>
      </Link>
      <Link href="https://play.google.com/store/apps/details?id=com.mobileappyc&pcampaignid=web_share">
        <Icon icon="ion:logo-google-playstore" width="29" height="29" />
        <div>
          <div className="app-store-text-small">Get it on</div>
          <div className="app-store-text-large">Google Play</div>
        </div>
      </Link>
    </div>
  );
};

export { PetDownBtn };
