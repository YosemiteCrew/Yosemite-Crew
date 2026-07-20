'use client';
import React from 'react';
import { Icon } from '@iconify/react';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperWebsiteBuilder.css';
import '@/app/features/organizations/styles/Organizations.css';

type TemplateLayout = 'editorial' | 'compact' | 'imagery';

type Template = {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: TemplateLayout;
};

const TEMPLATES: Template[] = [
  {
    id: 'alpine-clinic',
    name: 'Alpine Clinic',
    description: 'Warm editorial layout with a hero booking pill and services grid.',
    icon: 'ion:home-outline',
    layout: 'editorial',
  },
  {
    id: 'city-vets',
    name: 'City Vets',
    description: 'Compact single-page site tuned for urban multi-doctor practices.',
    icon: 'ion:business-outline',
    layout: 'compact',
  },
  {
    id: 'equine-estate',
    name: 'Equine Estate',
    description: 'Wide imagery layout for large-animal and mobile practices.',
    icon: 'ion:paw-outline',
    layout: 'imagery',
  },
];

const BUILDER_STEPS = ['Pick a template', 'Connect services', 'Go live'];

const TemplateSkeleton = ({ layout }: { layout: TemplateLayout }) => {
  if (layout === 'compact') {
    return (
      <div className="dev-wb-skeleton" aria-hidden="true">
        <span className="dev-wb-sk-bar" style={{ width: '52%', height: 10, borderRadius: 5 }} />
        <span
          className="dev-wb-sk-bar is-faded"
          style={{ width: '100%', height: 12, borderRadius: 6 }}
        />
        <span
          className="dev-wb-sk-bar is-faded"
          style={{ width: '100%', height: 12, borderRadius: 6 }}
        />
        <span className="dev-wb-sk-pill" />
      </div>
    );
  }

  if (layout === 'imagery') {
    return (
      <div className="dev-wb-skeleton" aria-hidden="true">
        <span
          className="dev-wb-sk-bar is-soft"
          style={{ width: '100%', height: 52, borderRadius: 8 }}
        />
        <span className="dev-wb-sk-bar" style={{ width: '58%', height: 9, borderRadius: 5 }} />
        <span className="dev-wb-sk-pill" />
      </div>
    );
  }

  return (
    <div className="dev-wb-skeleton" aria-hidden="true">
      <span className="dev-wb-sk-bar" style={{ width: '62%', height: 10, borderRadius: 5 }} />
      <span
        className="dev-wb-sk-bar is-soft"
        style={{ width: '40%', height: 8, borderRadius: 4 }}
      />
      <span className="dev-wb-sk-pill" />
      <div className="dev-wb-sk-tiles">
        <span className="dev-wb-sk-tile" />
        <span className="dev-wb-sk-tile" />
        <span className="dev-wb-sk-tile" />
      </div>
    </div>
  );
};

const DeveloperWebsiteBuilder = () => {
  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <div className="dev-wb-heading">
            <h1 className="text-page-title dev-wb-title">
              Website builder
              <Icon
                icon="ion:information-circle-outline"
                width={17}
                height={17}
                className="dev-wb-title-info"
                aria-hidden="true"
              />
            </h1>
            <p className="dev-wb-subtitle">
              A clinic website with booking built in, live in an afternoon.
            </p>
          </div>
          <Primary
            text="Open builder"
            icon={
              <Icon icon="ion:color-palette-outline" width={16} height={16} aria-hidden="true" />
            }
            href="/contact-us"
            style={{ maxWidth: 200 }}
          />
        </div>

        <p className="dev-wb-preview text-caption-2">
          Preview · the website builder is coming soon. Templates below are samples.
        </p>

        <section className="DevWebsiteBuilder">
          <div className="dev-wb-promo">
            <span className="dev-wb-badge text-caption-3">Website builder</span>
            <p className="dev-wb-promo-title font-newsreader">
              Pick a template, connect the clinic&apos;s services, and{' '}
              <span className="dev-wb-promo-accent">appointments land straight in the PIMS.</span>
            </p>
            <p className="dev-wb-promo-body">Custom domain included. Bookings sync in real time.</p>
            <div className="dev-wb-steps">
              {BUILDER_STEPS.map((step, index) => (
                <span key={step} className="dev-wb-step">
                  <span className="dev-wb-step-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="dev-wb-step-label">{step}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="dev-wb-section-head">
            <h2 className="dev-wb-section-title">Templates</h2>
            <span className="dev-wb-section-caption">
              Coming soon · sample templates for preview
            </span>
          </div>
          <div className="dev-wb-grid">
            {TEMPLATES.map((template) => (
              <div key={template.id} className="dev-wb-card">
                <span className="dev-wb-card-head">
                  <span className="dev-wb-card-thumb" aria-hidden="true">
                    <Icon icon={template.icon} width={19} height={19} />
                  </span>
                  <span className="dev-wb-card-sample text-caption-3">Sample</span>
                </span>
                <h3 className="dev-wb-card-title">{template.name}</h3>
                <p className="dev-wb-card-desc">{template.description}</p>
                <TemplateSkeleton layout={template.layout} />
                <span className="dev-wb-card-action">
                  Use template
                  <Icon icon="ion:arrow-forward" width={13} height={13} aria-hidden="true" />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperWebsiteBuilder;
