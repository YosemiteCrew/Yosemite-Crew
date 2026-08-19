'use client';
import React, { useMemo, useState } from 'react';
import { IoArrowForward, IoInformationCircleOutline, IoPlay } from 'react-icons/io5';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const GUIDES_PAGE_SKELETON = <PageSkeleton variant="list" />;
import GuidePlayerModal from '@/app/ui/overlays/Modal/GuidePlayerModal';
import Search from '@/app/ui/inputs/Search';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import FilteredEmptyState from '@/app/ui/layout/states/FilteredEmptyState';
import { guidesData } from '@/app/features/guides/data/guidesData';
import { GuideVideo } from '@/app/features/guides/types/guides';

const ALL_CATEGORY = 'All';

const GuideCardStatus = ({ guide }: { guide: GuideVideo }) => {
  if (typeof guide.progressPercent === 'number') {
    return (
      <span className="flex items-center gap-1">
        <span
          className="block h-1 w-11 overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--inset)' }}
        >
          <span
            className="block h-full"
            style={{ width: `${guide.progressPercent}%`, backgroundColor: 'var(--blue)' }}
          />
        </span>
        <span className="text-[11px] text-[var(--ink-faint)]">{guide.progressPercent}%</span>
      </span>
    );
  }
  if (guide.status === 'watched') {
    return <span className="text-[11px] text-[var(--ink-faint)]">Watched</span>;
  }
  if (guide.status === 'new') {
    return <span className="text-[11px] text-[var(--ink-faint)]">New</span>;
  }
  return null;
};

/**
 * Exported so Storybook can mount the page itself. The default export below is
 * wrapped in `ProtectedRoute` + `OrgGuard`, which hold a skeleton until a real
 * session and org membership resolve, so nothing on this page can be drawn
 * through it. Named export only; the route still imports the protected default.
 */
export const Guides = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [showModal, setShowModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<GuideVideo | null>(null);

  const categories = useMemo(() => {
    const items = new Set<string>();
    guidesData.forEach((guide) => items.add(guide.category));
    return [ALL_CATEGORY, ...Array.from(items)];
  }, []);

  const filteredGuides = useMemo(() => {
    const query = search.trim().toLowerCase();
    return guidesData.filter((guide) => {
      if (activeCategory !== ALL_CATEGORY && guide.category !== activeCategory) {
        return false;
      }
      if (!query) return true;
      const haystack = [guide.title, guide.description, guide.category, guide.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeCategory, search]);

  const activeIndex = activeVideo
    ? guidesData.findIndex((guide) => guide.id === activeVideo.id)
    : -1;
  const nextGuide = activeIndex >= 0 ? guidesData[(activeIndex + 1) % guidesData.length] : null;

  const handleOpenVideo = (video: GuideVideo) => {
    setActiveVideo(video);
    setShowModal(true);
  };

  const handleNextGuide = () => setActiveVideo(nextGuide);

  const handleClearFilters = () => {
    setSearch('');
    setActiveCategory(ALL_CATEGORY);
  };

  return (
    <div className="yc-page-content">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-[3px]">
          <h1
            className="flex items-center gap-2 text-[var(--ink)] text-[26px] leading-tight tracking-[-0.015em]"
            style={{ fontFamily: 'var(--font-newsreader)', fontWeight: 400 }}
          >
            {'Guides'}
            <span className="text-[17px]" style={{ color: 'var(--ink-faint)' }}>
              ({guidesData.length})
            </span>
            <IoInformationCircleOutline
              size={17}
              aria-hidden="true"
              style={{ color: 'var(--ink-faint)' }}
            />
          </h1>
          <span className="text-[13.5px] text-[var(--ink-muted)]">
            Short, practical walkthroughs · 2-6 minutes each
          </span>
        </div>
        <span className="text-[12.5px] text-[var(--ink-faint)]">
          Short, practical walkthroughs · updated with each release
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                className="rounded-full border px-[15px] py-[7px] text-[12.5px] transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--inset)',
                        borderColor: 'var(--divider)',
                        color: 'var(--ink)',
                        fontWeight: 700,
                      }
                    : {
                        borderColor: 'var(--hairline)',
                        color: 'var(--ink-muted)',
                        fontWeight: 600,
                      }
                }
              >
                {category}
              </button>
            );
          })}
        </div>
        <Search
          value={search}
          setSearch={setSearch}
          className="!w-full sm:!w-[240px]"
          placeholder="Search guides"
        />
      </div>

      {filteredGuides.length > 0 ? (
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-3">
          {filteredGuides.map((video) => (
            <button
              type="button"
              key={video.id}
              onClick={() => handleOpenVideo(video)}
              aria-label={`Play guide: ${video.title}`}
              className="flex flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] text-left shadow-[0_1px_2px_var(--sh03),0_10px_28px_var(--sh05)] transition-shadow hover:shadow-[0_4px_10px_var(--sh05),0_20px_50px_var(--sh10)]"
            >
              <div
                className="relative flex aspect-video w-full items-center justify-center"
                style={{ backgroundColor: '#23211f' }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-[52px] items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'rgba(247,243,236,0.92)',
                    color: '#1d1c1b',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  }}
                >
                  <IoPlay size={21} className="ml-[3px]" />
                </span>
                <span
                  className="absolute bottom-2.5 right-2.5 rounded-[7px] px-2 py-[3px] text-[10.5px] font-bold tabular-nums"
                  style={{ backgroundColor: 'rgba(0,0,0,0.62)', color: '#f7f3ec' }}
                >
                  {video.duration}
                </span>
                <StatusPill
                  className="absolute left-2.5 top-2.5"
                  tone="neutral"
                  label={video.category}
                />
              </div>
              <div className="flex flex-col gap-1.5 px-4 pb-[15px] pt-3.5">
                <span className="text-[14.5px] font-bold text-[var(--ink)]">{video.title}</span>
                <span className="text-[12px] leading-[1.55] text-[var(--ink-muted)]">
                  {video.description}
                </span>
                <span className="mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-[5px] text-[12px] font-semibold text-[var(--blue-text)]">
                    Watch now
                    <IoArrowForward size={12} aria-hidden="true" />
                  </span>
                  <GuideCardStatus guide={video} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <FilteredEmptyState
          title="No guides match your search"
          message="Try a different search or pick another category."
          onClearFilters={handleClearFilters}
          clearLabel="Clear filters"
        />
      )}

      <GuidePlayerModal
        showModal={showModal}
        setShowModal={setShowModal}
        guide={activeVideo}
        nextGuide={nextGuide}
        onNext={handleNextGuide}
      />
    </div>
  );
};

const ProtectedGuides = () => {
  return (
    <ProtectedRoute skeleton={GUIDES_PAGE_SKELETON}>
      <OrgGuard skeleton={GUIDES_PAGE_SKELETON}>
        <Guides />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedGuides;
