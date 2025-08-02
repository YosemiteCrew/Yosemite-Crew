'use client';

import "./Homepage.css";
import PracticeSection from "../../Components/PracticeSection/PracticeSection";
import FocusSection from "../../Components/FocusSection/FocusSection";
import TrustExpert from "../../Components/TrustExpert/TrustExpert";
import WhoCareSection from "../../Components/WhoCareSection/WhoCareSection";
import BetterCareSection from "../../Components/BetterCareSection/BetterCareSection";
import HeroSection from "../../Components/HeroSection/HeroSection";

const Homepage = () => {
  return (
      <div className="HomeMain">
        <HeroSection />
        <PracticeSection/>
        <FocusSection />
        <TrustExpert />
        <WhoCareSection/>
        <BetterCareSection />
      </div>
  );
};

export default Homepage;