'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/app/ui/Card';
import SiteTemplate from '@/app/features/websiteBuilder/components/SiteTemplate';
import {
  getPublicSite,
  type PublicSite,
} from '@/app/features/websiteBuilder/services/practiceWebsite.service';
import {
  BookFooter,
  BookShell,
  IconDisc,
  Skeleton,
  StateCard,
  WarnIcon,
} from '../../book/[slug]/bookingChrome';
import { STATE_BODY } from '../../book/[slug]/bookingStyles';

type SiteView =
  { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; site: PublicSite };

/**
 * The page a visitor sees at `/site/<slug>`: the practice's own website, with
 * "Book an appointment" leading to its booking page. A retired slug replaces
 * the URL with the current one, as the booking page does.
 */
const SiteClient = ({ slug }: { slug: string }) => {
  const router = useRouter();
  // Held in a ref so the load runs once per slug: a router whose identity
  // changes per render would otherwise re-run it forever. Synced in an effect,
  // not during render, as the booking page does.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const [view, setView] = useState<SiteView>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    getPublicSite(slug)
      .then((result) => {
        if (!active) return;
        if (result.kind === 'redirect') {
          routerRef.current.replace(`/site/${encodeURIComponent(result.slug)}`);
          return;
        }
        setView({ status: 'ready', site: result.site });
      })
      .catch(() => {
        if (active) setView({ status: 'unavailable' });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (view.status === 'loading') {
    return (
      <BookShell>
        <Card className="p-5 sm:p-8" aria-busy="true">
          <output className="sr-only">Loading this practice’s website</output>
          <Skeleton className="mx-auto h-10 w-2/3 rounded-xl" />
          <Skeleton className="mx-auto mt-3 h-5 w-1/2 rounded-xl" />
          <Skeleton className="mt-8 h-24 rounded-xl" />
        </Card>
        <BookFooter />
      </BookShell>
    );
  }

  if (view.status === 'unavailable') {
    return (
      <BookShell>
        <StateCard
          headingLevel="h1"
          heading="This website is not available"
          icon={
            <IconDisc tone="warn">
              <WarnIcon />
            </IconDisc>
          }
        >
          <p className={STATE_BODY}>
            The address may be wrong, or the practice may have taken its website down.
          </p>
        </StateCard>
        <BookFooter />
      </BookShell>
    );
  }

  const { site } = view;
  return (
    <BookShell>
      <Card className="p-5 sm:p-10">
        <SiteTemplate
          content={site}
          practice={site.practice}
          bookingHref={`/book/${encodeURIComponent(site.practice.slug)}`}
        />
      </Card>
      <BookFooter />
    </BookShell>
  );
};

export default SiteClient;
