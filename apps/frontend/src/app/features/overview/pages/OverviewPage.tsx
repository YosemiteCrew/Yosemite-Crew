'use client';
import React from 'react';
import Image from 'next/image';
import './Overview.css';
import CommunityStats from '../components/CommunityStats';
import { useOverviewStats } from '../hooks/useOverviewStats';
import Footer from '@/app/ui/widgets/Footer/Footer';
import { Primary } from '@/app/ui/primitives/Buttons';
import { useAuthStore } from '@/app/stores/authStore';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

const OverviewPage = () => {
  const { trafficChart, starsChart, totalStars, totalForks, isLoading } = useOverviewStats();
  const { user, role } = useAuthStore();

  const getCtaHref = () => {
    if (user) {
      return role === 'developer' ? '/developers/home' : resolveDefaultOpenScreenRoute(role);
    }
    return '/signup';
  };

  const formatStat = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <>
      <div className="OverviewPageWrapper">
        <div className="OverviewHeroSection">
          <main className="OverviewMainContent">
            <h1 className="OverviewMainTitle">Building in Public</h1>

            <p className="OverviewLeadText">
              Most companies keep their numbers private. We don’t. Sharing them keeps us honest.
              When numbers are public, you see what’s working and what isn’t. It pushes better
              decisions. We learned this from open source.
            </p>

            <div className="OverviewStatsRow">
              <div className="StatItem">
                <span className="StatNumber">
                  {isLoading ? '-' : formatStat(totalStars)}
                  <span className="StatPlus">+</span>
                </span>
                <span className="StatLabel">GitHub Stars</span>
              </div>

              <div className="StatItem">
                <span className="StatNumber">
                  {isLoading ? '-' : formatStat(totalForks)}
                  <span className="StatPlus">+</span>
                </span>
                <span className="StatLabel">GitHub Forks</span>
              </div>

              <div className="StatItem">
                <span className="StatNumber">
                  {isLoading ? '-' : '15'}
                  <span className="StatPlus">+</span>
                </span>
                <span className="StatLabel">Contributors</span>
              </div>
            </div>

            <div className="OverviewImageWrapper">
              <Image
                src="https://d2il6osz49gpup.cloudfront.net/statsPage/statLanding.png"
                alt="Veterinarians working together"
                width={1000}
                height={460}
                className="OverviewImage"
                priority
              />
            </div>
          </main>
        </div>

        <div className="OverviewBottomSection">
          <main className="OverviewMainContent">
            <p className="OverviewSecondaryText">
              What you measure shows what you actually care about, and it attracts people who care
              about the same things. Some months are messy. That’s part of it. Hiding it only delays
              fixing it. Over time, we’ll share more as we build better ways to publish data without
              compromising user sovereignty. If you’re building in the open, it shouldn’t stop at
              code.
            </p>

            <div className="OverviewCtaWrapper">
              <Primary size="large" text={user ? 'Go to app' : 'Go to App'} href={getCtaHref()} />
            </div>

            <h2 className="OverviewGraphsTitle">When numbers are public, you see what’s working</h2>

            <div className="OverviewGraphsWrapper">
              <CommunityStats
                trafficChart={trafficChart}
                starsChart={starsChart}
                isLoading={isLoading}
              />
            </div>
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default OverviewPage;
