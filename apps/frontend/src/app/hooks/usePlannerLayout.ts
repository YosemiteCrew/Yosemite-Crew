import { useEffect, useRef } from 'react';

type PlannerLayoutOptions = {
  activeView: string;
  topOffset?: number;
};

type PlannerLayoutClassesOptions = {
  activeView: string;
  listWrapperClassName: string;
  plannerClassName: string;
};

export const getPlannerLayoutClassNames = ({
  activeView,
  listWrapperClassName,
  plannerClassName,
}: PlannerLayoutClassesOptions) => ({
  wrapperClassName: activeView === 'list' ? listWrapperClassName : 'w-full flex flex-col gap-3',
  plannerSectionClassName:
    activeView === 'list' ? 'w-full flex-1 min-h-0 overflow-hidden' : plannerClassName,
});

export const usePlannerAutoLock = ({ activeView, topOffset = 16 }: PlannerLayoutOptions) => {
  const plannerSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerAutoLockRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (activeView === 'list') return;
    if (globalThis.window === undefined) return;

    lastScrollYRef.current = globalThis.window.scrollY;

    const onScroll = () => {
      const section = plannerSectionRef.current;
      if (!section) return;

      const currentY = globalThis.window.scrollY;
      const isScrollingDown = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const rect = section.getBoundingClientRect();
      const shouldLockToSection =
        isScrollingDown &&
        rect.top <= 130 &&
        rect.top >= -180 &&
        rect.bottom > globalThis.window.innerHeight * 0.55;

      if (shouldLockToSection && !plannerAutoLockRef.current) {
        plannerAutoLockRef.current = true;
        globalThis.window.scrollTo({
          top: globalThis.window.scrollY + rect.top - topOffset,
          behavior: 'smooth',
        });
        return;
      }

      if (rect.top > 220) {
        plannerAutoLockRef.current = false;
      }
    };

    globalThis.window.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.window.removeEventListener('scroll', onScroll);
  }, [activeView, topOffset]);

  return { plannerSectionRef };
};
