"use client";
import React, { useMemo, useState } from "react";
import { FaCirclePlay } from "react-icons/fa6";

import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import CenterModal from "@/app/ui/overlays/Modal/CenterModal";
import Close from "@/app/ui/primitives/Icons/Close";
import Search from "@/app/ui/inputs/Search";
import { Primary } from "@/app/ui/primitives/Buttons";
import { guidesData } from "@/app/features/guides/data/guidesData";
import { GuideVideo } from "@/app/features/guides/types/guides";

const categoryPalette = [
  { bg: "#247AED", text: "#EAF3FF" },
  { bg: "#F1D4B0", text: "#302f2e" },
  { bg: "#A8A181", text: "#F7F7F7" },
  { bg: "#BF9FAA", text: "#F7F7F7" },
  { bg: "#D28F9A", text: "#F7F7F7" },
  { bg: "#5C614B", text: "#F7F7F7" },
  { bg: "#D9A488", text: "#F7F7F7" },
];

const Guides = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<GuideVideo | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const categories = useMemo(() => {
    const items = new Set<string>();
    guidesData.forEach((guide) => items.add(guide.category));
    return ["All", ...Array.from(items)];
  }, []);

  const categoryStyles = useMemo(() => {
    const styleMap = new Map<string, { bg: string; text: string }>();
    categories.forEach((category, index) => {
      const paletteIndex = index % categoryPalette.length;
      styleMap.set(category, categoryPalette[paletteIndex]);
    });
    return styleMap;
  }, [categories]);

  const featuredGuide = useMemo(() => {
    return guidesData.find((guide) => guide.featured) ?? guidesData[0] ?? null;
  }, []);

  const filteredGuides = useMemo(() => {
    const query = search.trim().toLowerCase();
    return guidesData.filter((guide) => {
      if (activeCategory !== "All" && guide.category !== activeCategory) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        guide.title,
        guide.description,
        guide.category,
        guide.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeCategory, search]);

  const handleOpenVideo = (video: GuideVideo) => {
    setActiveVideo(video);
    setIsVideoLoaded(false);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col gap-8 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1">
            Guides & Tutorials{" "}
            <span className="text-text-tertiary">{`(${guidesData.length})`}</span>
          </div>
          <p className="text-body-3 text-text-secondary max-w-3xl mb-0!">
            Learn how to set up your animal health practice, streamline workflows, and get the most from Yosemite.
          </p>
        </div>
      </div>

      {featuredGuide && (
        <div className="rounded-2xl! border border-card-border bg-white overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr]">
            <button
              type="button"
              className="relative aspect-video lg:aspect-auto lg:min-h-[280px] bg-no-repeat bg-cover bg-center w-full flex items-center justify-center"
              style={{ backgroundImage: `url(${featuredGuide.thumbnailUrl})` }}
              onClick={() => handleOpenVideo(featuredGuide)}
              aria-label={`Play featured video: ${featuredGuide.title}`}
            >
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-white/20">
                <FaCirclePlay size={50} color="#fff" />
              </div>
              <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-white/90 text-body-4 text-text-primary">
                {featuredGuide.duration}
              </div>
            </button>
            <div className="flex flex-col gap-3 px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 lg:justify-center">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-body-4 text-text-primary bg-[#F1D4B0] px-3 py-1 rounded-full">
                  Featured
                </div>
                <div className="text-body-4 text-text-brand bg-brand-100 px-3 py-1 rounded-full">
                  {featuredGuide.category}
                </div>
              </div>
              <div className="text-heading-2 text-text-primary">
                {featuredGuide.title}
              </div>
              <div className="text-body-3 text-text-secondary">
                {featuredGuide.description}
              </div>
              <Primary
                text="Watch now"
                href="#"
                onClick={() => handleOpenVideo(featuredGuide)}
                classname="px-6 w-fit"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            const palette = categoryStyles.get(category);
            return (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
                style={
                  isActive && palette
                    ? { backgroundColor: palette.bg, color: palette.text }
                    : undefined
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
          className="!w-full sm:!w-[280px]"
          placeholder="Search guides"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-body-2 text-text-primary">All guides</div>
          <div className="text-body-4 text-text-tertiary">
            {filteredGuides.length} results
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredGuides.map((video) => (
            <button
              type="button"
              className="rounded-2xl! border border-card-border bg-white flex flex-col cursor-pointer text-left hover:shadow-sm transition-all duration-300"
              key={video.id}
              onClick={() => handleOpenVideo(video)}
              aria-label={`Play video: ${video.title}`}
            >
              <div
                style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                className="relative aspect-video bg-no-repeat bg-cover bg-center w-full rounded-t-2xl flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-black/35 rounded-t-2xl" />
                <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-white/20">
                  <FaCirclePlay size={46} color="#fff" />
                </div>
                <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-white/90 text-body-4 text-text-primary">
                  {video.duration}
                </div>
              </div>
              <div className="flex flex-col gap-2 px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="text-body-4 text-text-brand bg-brand-100 px-3 py-1 rounded-full">
                    {video.category}
                  </div>
                </div>
                <div className="text-body-2 text-text-primary">{video.title}</div>
                <div className="text-body-4 text-text-secondary">
                  {video.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <CenterModal
          showModal={showModal}
          setShowModal={setShowModal}
          onClose={() => {
            setShowModal(false);
            setIsVideoLoaded(false);
          }}
          containerClassName="sm:w-[720px] md:w-[860px] lg:w-[980px] max-w-[95vw]"
        >
          <div className="relative flex items-center justify-center">
            <div className="text-body-2 text-text-primary text-center">
              {activeVideo?.title ?? "Video"}
            </div>
            <div className="absolute right-0">
              <Close
                onClick={() => {
                  setShowModal(false);
                  setIsVideoLoaded(false);
                }}
              />
            </div>
          </div>
          <div className="relative rounded-2xl border border-card-border overflow-hidden">
            {activeVideo ? (
              <video
                key={activeVideo.videoUrl}
                className="w-full h-auto"
                controls
                preload="metadata"
                poster={activeVideo.thumbnailUrl}
                onLoadedData={() => setIsVideoLoaded(true)}
              >
                <source src={activeVideo.videoUrl} type="video/mp4" />
                <track
                  kind="captions"
                  src="data:text/vtt,WEBVTT"
                  srcLang="en"
                  label="English"
                  default
                />
              </video>
            ) : (
              <div className="w-full aspect-video bg-black/80" />
            )}
            {activeVideo && !isVideoLoaded && (
              <div
                className="absolute inset-0 bg-no-repeat bg-cover bg-center"
                style={{ backgroundImage: `url(${activeVideo.thumbnailUrl})` }}
                aria-hidden="true"
              />
            )}
          </div>
        </CenterModal>
      )}
    </div>
  );
};

const ProtectedGuides = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Guides />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedGuides;
