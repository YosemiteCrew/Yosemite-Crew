'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getCalApi } from '@calcom/embed-react';
import { getCalEmbedUrl } from '@/app/ui/overlays/calEmbedUtils';

type CalEmbedFrameProps = {
  calLink: 'yosemitecrew/demo' | 'yosemitecrew/onboarding';
  title: string;
  className?: string;
};

const CAL_EMBED_NAMESPACE = '30min';
const CAL_EMBED_CONFIG = {
  theme: 'light' as const,
  layout: 'month_view' as const,
};

const CalEmbedFrame = ({
  calLink,
  title,
  className = 'flex-1 w-full border-0',
}: CalEmbedFrameProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failedCalLink, setFailedCalLink] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current as HTMLDivElement;

    let cancelled = false;
    container.replaceChildren();

    const mountCalendar = async () => {
      const cal = await getCalApi({ namespace: CAL_EMBED_NAMESPACE });
      if (cancelled || !container.isConnected) return;

      setFailedCalLink(null);
      cal('ui', {
        hideEventTypeDetails: false,
        layout: CAL_EMBED_CONFIG.layout,
      });
      cal('inline', {
        elementOrSelector: container,
        calLink,
        config: CAL_EMBED_CONFIG,
      });
    };

    void mountCalendar().catch(() => {
      if (!cancelled) setFailedCalLink(calLink);
    });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [calLink]);

  return (
    <>
      <div
        ref={containerRef}
        aria-label={title}
        data-cal-embed-frame="true"
        data-cal-embed-src={getCalEmbedUrl(calLink)}
        className={className}
        style={{ pointerEvents: 'auto' }}
      />
      {failedCalLink === calLink && (
        <p role="alert" className="text-body-4 text-danger-600">
          The calendar could not be loaded. Please try again later.
        </p>
      )}
    </>
  );
};

export default CalEmbedFrame;
