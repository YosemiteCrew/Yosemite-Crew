import React from 'react';

/**
 * Loading placeholder for the three plan cards while `/v1/pricing` is in
 * flight. Mirrors the real card layout so there is no layout shift when
 * the real data lands.
 */
const PricingSkeleton = () => {
  return (
    <div
      className="flex gap-3 lg:gap-[30px] justify-between w-full flex-col md:flex-row"
      aria-busy="true"
      aria-live="polite"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="p-3 flex flex-col gap-3 w-full md:w-[calc(33%-11px)] lg:w-[calc(33%-20px)] rounded-[20px] border border-grey-light animate-pulse"
        >
          <div className="h-6 w-28 bg-grey-light rounded" />
          <div className="h-10 w-24 bg-grey-light rounded mt-1" />
          <div className="h-4 w-full bg-grey-light rounded" />
          <div className="h-4 w-3/4 bg-grey-light rounded" />
          <div className="h-12 w-full bg-grey-light rounded-2xl mt-2" />
          <div className="flex flex-col gap-2 mt-2">
            <div className="h-3 w-5/6 bg-grey-light rounded" />
            <div className="h-3 w-4/6 bg-grey-light rounded" />
            <div className="h-3 w-5/6 bg-grey-light rounded" />
            <div className="h-3 w-3/6 bg-grey-light rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PricingSkeleton;
