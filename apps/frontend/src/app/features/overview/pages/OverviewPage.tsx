'use client';
import React from 'react';
import './Overview.css';
import OverviewHero from '../components/OverviewHero';
import CommunityStats from '../components/CommunityStats';
import WhyWeDoThis from '../components/WhyWeDoThis';
import { useOverviewStats } from '../hooks/useOverviewStats';
import Footer from '@/app/ui/widgets/Footer/Footer';

const OverviewPage = () => {
  const { combinedChart, isLoading } = useOverviewStats();

  return (
    <>
      <div className="OverviewPageWrapper">
        <OverviewHero />

        <div className="OverviewContentContainer">
          <CommunityStats combinedChart={combinedChart} isLoading={isLoading} />

          {/* Added the new component here */}
          <WhyWeDoThis />
        </div>
      </div>
      <Footer />
    </>
  );
};

export default OverviewPage;
