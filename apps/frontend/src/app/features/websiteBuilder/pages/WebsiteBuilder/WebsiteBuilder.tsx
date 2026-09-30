'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/ui/icons/Icon';
import Input, { Textarea } from '@/app/ui/Input';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';
import SiteTemplate from '@/app/features/websiteBuilder/components/SiteTemplate';
import { WEBSITE_COPY_LIMITS, WEBSITE_TEMPLATES } from '@/app/features/websiteBuilder/templates';
import {
  practiceWebsiteApi,
  type PracticeWebsiteConfig,
  type WebsiteContent,
} from '@/app/features/websiteBuilder/services/practiceWebsite.service';

const LABEL = 'text-[12.5px] font-semibold text-[var(--ink)]';
const HINT = 'text-[11.5px] text-[var(--ink-muted)]';

const toContent = (config: PracticeWebsiteConfig): WebsiteContent => ({
  templateId: config.templateId,
  headline: config.headline,
  tagline: config.tagline,
  about: config.about,
});

type BuilderView =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; config: PracticeWebsiteConfig; draft: WebsiteContent };

const statusText = (config: PracticeWebsiteConfig): string => {
  if (!config.published) return 'Draft. Visitors cannot see this site yet.';
  if (!config.publicBookingEnabled) return 'Published, but hidden while online booking is off.';
  return 'Live. Visitors can see this site.';
};

const StatusPanel = ({
  config,
  canPublish,
}: {
  config: PracticeWebsiteConfig;
  canPublish: boolean;
}) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-4 py-3">
    <span className="text-[13px] font-semibold text-[var(--ink)]">{statusText(config)}</span>
    {config.publicUrl && (
      <a
        href={config.publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] break-all text-[var(--blue-text)] underline!"
      >
        {config.publicUrl}
      </a>
    )}
    {!canPublish && (
      <span className="text-[12.5px] text-[var(--ink-body)]">
        Your website&apos;s booking button opens your booking page, so turn on online booking before
        you publish.{' '}
        <Link href="/public-booking-setup" className="text-[var(--blue-text)] underline!">
          Set up online booking
        </Link>
      </span>
    )}
  </div>
);

const TemplatePicker = ({
  value,
  onChange,
}: {
  value: WebsiteContent['templateId'];
  onChange: (templateId: WebsiteContent['templateId']) => void;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className={`${LABEL} mb-2`}>Template</legend>
    {WEBSITE_TEMPLATES.map((template) => {
      const checked = value === template.id;
      return (
        <label
          key={template.id}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
            checked ? 'border-[var(--blue-text)] bg-[var(--blue-soft)]' : 'border-[var(--hairline)]'
          }`}
        >
          <input
            type="radio"
            name="template"
            value={template.id}
            checked={checked}
            onChange={() => onChange(template.id)}
            className="mt-1"
          />
          <Icon icon={template.icon} width={18} height={18} aria-hidden="true" />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">{template.name}</span>
            <span className={HINT}>{template.description}</span>
          </span>
        </label>
      );
    })}
  </fieldset>
);

const CopyFields = ({
  draft,
  headlineMissing,
  onChange,
}: {
  draft: WebsiteContent;
  headlineMissing: boolean;
  onChange: (patch: Partial<WebsiteContent>) => void;
}) => (
  <>
    <div className="flex flex-col gap-1.5">
      <label htmlFor="website-headline" className={LABEL}>
        Headline
      </label>
      <Input
        id="website-headline"
        placeholder="Caring for your pets since 1998"
        value={draft.headline}
        maxLength={WEBSITE_COPY_LIMITS.headline}
        error={headlineMissing}
        aria-describedby={headlineMissing ? 'website-headline-error' : undefined}
        onChange={(event) => onChange({ headline: event.target.value })}
      />
      {headlineMissing && (
        <span id="website-headline-error" className="text-[11.5px] text-[var(--danger-text)]">
          Add a headline for your website.
        </span>
      )}
    </div>

    <div className="flex flex-col gap-1.5">
      <label htmlFor="website-tagline" className={LABEL}>
        Tagline <span className={HINT}>(optional)</span>
      </label>
      <Input
        id="website-tagline"
        placeholder="Open late on weekdays"
        value={draft.tagline ?? ''}
        maxLength={WEBSITE_COPY_LIMITS.tagline}
        onChange={(event) => onChange({ tagline: event.target.value })}
      />
    </div>

    <div className="flex flex-col gap-1.5">
      <label htmlFor="website-about" className={LABEL}>
        About your practice <span className={HINT}>(optional)</span>
      </label>
      <Textarea
        id="website-about"
        rows={6}
        value={draft.about ?? ''}
        maxLength={WEBSITE_COPY_LIMITS.about}
        onChange={(event) => onChange({ about: event.target.value })}
      />
      <span className={HINT}>Leave a blank line between paragraphs.</span>
    </div>
  </>
);

/**
 * Where a practice builds its clinic website: pick a template, write the copy,
 * check the preview, and publish.
 *
 * The site's call to action is the practice's booking page, so publishing is
 * offered only once online booking is live. The API enforces the same rule.
 */
const WebsiteBuilder = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = usePrimaryOrg();
  const services = useRevampCatalogStore((s) => s.services);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);

  // One state for the load, so "ready" always carries both the saved site and
  // the draft being edited.
  const [view, setView] = useState<BuilderView>({ status: 'loading' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!primaryOrgId) return;
    let active = true;
    practiceWebsiteApi
      .getConfig(primaryOrgId)
      .then((loaded) => {
        if (active) setView({ status: 'ready', config: loaded, draft: toContent(loaded) });
      })
      .catch(() => {
        if (active) setView({ status: 'failed' });
      });
    // Without the catalog the preview shows no services, so say why.
    Promise.resolve(loadOrganisationCatalog(primaryOrgId)).catch(() => {
      if (!active) return;
      notify('warning', {
        title: 'Could not load your services',
        text: 'The preview may be missing services. Refresh to try again.',
      });
    });
    return () => {
      active = false;
    };
  }, [primaryOrgId, loadOrganisationCatalog, notify]);

  // The preview lists what the booking page can offer: active, bookable services.
  const previewPractice = useMemo(
    () => ({
      name: primaryOrg?.name || 'Your clinic',
      city: null,
      country: null,
      services: services.flatMap((service) =>
        service.isBookable && service.status === 'ACTIVE'
          ? [
              {
                id: service.id,
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
              },
            ]
          : []
      ),
    }),
    [primaryOrg?.name, services]
  );

  if (view.status === 'failed') {
    return (
      <div className="flex flex-col gap-2 p-3! md:p-5!">
        <h1 className="text-page-title">Website builder</h1>
        <p role="alert" className="text-[13px] text-[var(--ink-body)]">
          We could not load your website. Please refresh the page to try again.
        </p>
      </div>
    );
  }

  if (view.status === 'loading') {
    return (
      <div className="flex flex-col gap-2 p-3! md:p-5!" aria-busy="true">
        <h1 className="text-page-title">Website builder</h1>
        <output className="text-[13px] text-[var(--ink-muted)]">Loading your website…</output>
      </div>
    );
  }

  const { config, draft } = view;
  const headlineMissing = draft.headline.trim().length === 0;
  const canPublish = config.publicBookingEnabled && Boolean(config.slug);

  const update = (patch: Partial<WebsiteContent>) =>
    setView({ status: 'ready', config, draft: { ...draft, ...patch } });

  const save = (published: boolean) => {
    if (!primaryOrgId || saving || headlineMissing) return;
    setSaving(true);
    practiceWebsiteApi
      .saveConfig(primaryOrgId, {
        templateId: draft.templateId,
        headline: draft.headline.trim(),
        tagline: draft.tagline?.trim() || null,
        about: draft.about?.trim() || null,
        published,
      })
      .then((saved) => {
        setView({ status: 'ready', config: saved, draft: toContent(saved) });
        notify('success', { title: 'Website saved', text: statusText(saved) });
      })
      .catch(() => {
        notify('error', {
          title: 'Could not save your website',
          text: 'Nothing was changed. Please try again.',
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex flex-col gap-5 p-3! md:p-5!">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">Website builder</h1>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Build a clinic website with online booking built in.
        </p>
      </div>

      <StatusPanel config={config} canPublish={canPublish} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <TemplatePicker
            value={draft.templateId}
            onChange={(templateId) => update({ templateId })}
          />

          <CopyFields draft={draft} headlineMissing={headlineMissing} onChange={update} />

          <div className="flex flex-wrap gap-2">
            <Primary
              type="button"
              text={config.published ? 'Update website' : 'Publish website'}
              onClick={() => save(true)}
              isDisabled={saving || headlineMissing || !canPublish}
            />
            <Secondary
              type="button"
              text={config.published ? 'Unpublish' : 'Save draft'}
              isDisabled={saving || headlineMissing}
              onClick={() => save(false)}
            />
          </div>
        </div>

        <section aria-labelledby="website-preview-title" className="flex min-w-0 flex-col gap-2">
          <h2 id="website-preview-title" className={LABEL}>
            Preview
          </h2>
          <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--page)] p-5 sm:p-8">
            <SiteTemplate content={draft} practice={previewPractice} bookingHref={null} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default WebsiteBuilder;
