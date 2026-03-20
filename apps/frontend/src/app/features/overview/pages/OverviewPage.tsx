'use client';
import React from 'react';
import './Overview.css';
import OverviewHero from '../components/OverviewHero';
import CommunityStats from '../components/CommunityStats';
import { useOverviewStats } from '../hooks/useOverviewStats';
import Footer from '@/app/ui/widgets/Footer/Footer';

const OverviewPage = () => {
  const { data, clonesChart, forksChart, starsChart, isLoading } = useOverviewStats();

  return (
    <>
      <div className="OverviewPageWrapper">
        <OverviewHero />

        <div className="OverviewContentContainer">
          <CommunityStats
            data={data}
            clonesChart={clonesChart}
            forksChart={forksChart}
            starsChart={starsChart}
            isLoading={isLoading}
          />
        </div>
      </div>
      <Footer />
    </>
  );
};

export default OverviewPage;
