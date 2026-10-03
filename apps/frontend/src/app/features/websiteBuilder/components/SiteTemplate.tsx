import React from 'react';
import Link from 'next/link';
import type { WebsiteContent } from '@/app/features/websiteBuilder/services/practiceWebsite.service';

/**
 * A practice website, rendered from one of the builder's templates.
 *
 * The same component draws the live site at `/site/<slug>` and the preview in
 * the builder, so what the practice sees while editing is what visitors get.
 * Colours come from the app's tokens, so the site follows light and dark mode.
 */

export type SitePractice = {
  name: string;
  city: string | null;
  country: string | null;
  services: { id: string; name: string; description: string | null; durationMinutes: number }[];
};

type SiteTemplateProps = {
  content: WebsiteContent;
  practice: SitePractice;
  /** Where "Book an appointment" goes. Null renders the button disabled. */
  bookingHref: string | null;
};

/** Split on blank lines. A line scan, not a regex, so it stays linear. */
const paragraphs = (text: string | null): string[] => {
  const result: string[] = [];
  let current: string[] = [];
  for (const line of (text ?? '').split('\n')) {
    if (line.trim()) {
      current.push(line.trim());
    } else if (current.length > 0) {
      result.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) result.push(current.join(' '));
  return result;
};

const location = (practice: SitePractice): string | null =>
  [practice.city, practice.country].filter(Boolean).join(', ') || null;

const BookButton = ({ href }: { href: string | null }) => {
  const className =
    'inline-flex items-center justify-center rounded-full bg-[var(--cta)] px-5 py-2.5 text-[14px] font-semibold text-[var(--cta-text)]';
  if (!href) {
    return (
      <span aria-disabled="true" className={`${className} cursor-not-allowed opacity-60`}>
        Book an appointment
      </span>
    );
  }
  return (
    <Link href={href} className={className}>
      Book an appointment
    </Link>
  );
};

const About = ({ about }: { about: string | null }) => {
  const parts = paragraphs(about);
  if (parts.length === 0) return null;
  return (
    <section aria-labelledby="site-about" className="flex flex-col gap-2">
      <h2 id="site-about" className="text-[20px] font-semibold text-[var(--ink)]">
        About us
      </h2>
      {(() => {
        const occurrences = new Map<string, number>();
        return parts.map((part) => {
          const occurrence = occurrences.get(part) ?? 0;
          occurrences.set(part, occurrence + 1);
          return (
            <p
              key={`${part}:${occurrence}`}
              className="text-[15px] leading-relaxed text-[var(--ink-body)]"
            >
              {part}
            </p>
          );
        });
      })()}
    </section>
  );
};

const Services = ({
  services,
  layout,
}: {
  services: SitePractice['services'];
  layout: 'grid' | 'list';
}) => {
  if (services.length === 0) return null;
  return (
    <section aria-labelledby="site-services" className="flex flex-col gap-3">
      <h2 id="site-services" className="text-[20px] font-semibold text-[var(--ink)]">
        Services
      </h2>
      <ul
        className={
          layout === 'grid'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col divide-y divide-[var(--divider)] rounded-2xl border border-[var(--hairline)]'
        }
      >
        {services.map((service) => (
          <li
            key={service.id}
            className={
              layout === 'grid'
                ? 'flex flex-col gap-1 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] p-4'
                : 'flex items-baseline justify-between gap-3 px-4 py-3'
            }
          >
            <span className="text-[15px] font-semibold text-[var(--ink)]">{service.name}</span>
            {service.durationMinutes > 0 && (
              <span className="text-[13px] text-[var(--ink-muted)]">
                {service.durationMinutes} min
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

const SiteTemplate = ({ content, practice, bookingHref }: SiteTemplateProps) => {
  const place = location(practice);

  if (content.templateId === 'city-vets') {
    return (
      <article data-template="city-vets" className="flex flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
          <span className="text-[16px] font-bold text-[var(--ink)]">{practice.name}</span>
          <BookButton href={bookingHref} />
        </header>
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] leading-tight font-semibold text-[var(--ink)]">
            {content.headline}
          </h1>
          {content.tagline && (
            <p className="text-[16px] text-[var(--ink-body)]">{content.tagline}</p>
          )}
          {place && <p className="text-[13px] text-[var(--ink-muted)]">{place}</p>}
        </div>
        <Services services={practice.services} layout="list" />
        <About about={content.about} />
      </article>
    );
  }

  if (content.templateId === 'equine-estate') {
    return (
      <article data-template="equine-estate" className="flex flex-col gap-8">
        <header className="flex min-h-[220px] flex-col justify-end gap-3 rounded-3xl bg-[var(--blue-soft)] p-6 sm:p-10">
          <span className="text-[13px] font-semibold tracking-wide text-[var(--blue-text)] uppercase">
            {practice.name}
          </span>
          <h1 className="font-newsreader text-[38px] leading-tight text-[var(--ink)]">
            {content.headline}
          </h1>
          {content.tagline && (
            <p className="text-[16px] text-[var(--ink-body)]">{content.tagline}</p>
          )}
          <div>
            <BookButton href={bookingHref} />
          </div>
        </header>
        <About about={content.about} />
        <Services services={practice.services} layout="grid" />
        {place && <p className="text-[13px] text-[var(--ink-muted)]">{place}</p>}
      </article>
    );
  }

  return (
    <article data-template="alpine-clinic" className="flex flex-col gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-[13px] font-semibold text-[var(--ink-muted)]">{practice.name}</span>
        <h1 className="font-newsreader text-[40px] leading-tight text-[var(--ink)]">
          {content.headline}
        </h1>
        {content.tagline && (
          <p className="max-w-[560px] text-[16px] text-[var(--ink-body)]">{content.tagline}</p>
        )}
        <BookButton href={bookingHref} />
        {place && <p className="text-[13px] text-[var(--ink-muted)]">{place}</p>}
      </header>
      <Services services={practice.services} layout="grid" />
      <About about={content.about} />
    </article>
  );
};

export default SiteTemplate;
