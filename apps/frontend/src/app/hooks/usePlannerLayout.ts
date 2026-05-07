import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/app/features/appointments/components/Calendar/helpers';

type PlannerLayoutOptions = {
  activeView: string;
  topOffset?: number;
};

type PlannerLayoutClassesOptions = {
  activeView: string;
  listWrapperClassName: string;
  plannerClassName: string;
};

type PlannerAutoLockConfig = {
  lockTop: number;
  lockMinTop: number;
  minBottomRatio: number;
  resetTop: number;
  scrollOffset: number;
};

const MOBILE_PLANNER_BREAKPOINT = 768;

export const getPlannerAutoLockConfig = (
  viewportWidth: number,
  topOffset: number
): PlannerAutoLockConfig => {
  if (viewportWidth < MOBILE_PLANNER_BREAKPOINT) {
    const coveredHeaderOffset = Math.max(56, Math.min(topOffset, 96));
    return {
      lockTop: Math.max(160, topOffset + 88),
      lockMinTop: -120,
      minBottomRatio: 0.35,
      resetTop: Math.max(240, topOffset + 168),
      scrollOffset: -coveredHeaderOffset,
    };
  }

  return {
    lockTop: 130,
    lockMinTop: -180,
    minBottomRatio: 0.55,
    resetTop: 220,
    scrollOffset: topOffset,
  };
};

export const getPlannerLayoutClassNames = ({
  activeView,
  listWrapperClassName,
  plannerClassName,
}: PlannerLayoutClassesOptions) => ({
  wrapperClassName:
    activeView === 'list'
      ? `${listWrapperClassName} max-lg:h-auto max-lg:max-h-none max-lg:min-h-[420px]`
      : 'w-full flex flex-col gap-3',
  plannerSectionClassName:
    activeView === 'list'
      ? 'w-full flex-1 min-h-[360px] md:min-h-[420px] lg:min-h-0 overflow-hidden'
      : plannerClassName,
});

export const usePlannerAutoLock = ({ activeView, topOffset = 16 }: PlannerLayoutOptions) => {
  const plannerSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerAutoLockRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (globalThis.window === undefined) return;

    lastScrollYRef.current = globalThis.window.scrollY;

    const onScroll = () => {
      const section = plannerSectionRef.current;
      if (!section) return;

      const currentY = globalThis.window.scrollY;
      const isScrollingDown = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const rect = section.getBoundingClientRect();
      const config = getPlannerAutoLockConfig(globalThis.window.innerWidth, topOffset);
      const shouldLockToSection =
        isScrollingDown &&
        rect.top <= config.lockTop &&
        rect.top >= config.lockMinTop &&
        rect.bottom > globalThis.window.innerHeight * config.minBottomRatio;

      if (shouldLockToSection && !plannerAutoLockRef.current) {
        plannerAutoLockRef.current = true;
        globalThis.window.scrollTo({
          top: globalThis.window.scrollY + rect.top - config.scrollOffset,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        return;
      }

      if (rect.top > config.resetTop) {
        plannerAutoLockRef.current = false;
      }
    };

    globalThis.window.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.window.removeEventListener('scroll', onScroll);
  }, [activeView, topOffset]);

  return { plannerSectionRef };
};
