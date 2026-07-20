'use client';
import React from 'react';
import { Icon } from '@iconify/react';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperWebsiteBuilder.css';
import '@/app/features/organizations/styles/Organizations.css';

type Template = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

const TEMPLATES: Template[] = [
  {
    id: 'alpine-clinic',
    name: 'Alpine Clinic',
    description: 'Warm editorial layout with a hero booking pill and services grid.',
    icon: 'ion:home-outline',
  },
  {
    id: 'city-vets',
    name: 'City Vets',
    description: 'Compact single-page site tuned for urban multi-doctor practices.',
    icon: 'ion:business-outline',
  },
  {
    id: 'equine-estate',
    name: 'Equine Estate',
    description: 'Wide imagery layout for large-animal and mobile practices.',
    icon: 'ion:paw-outline',
  },
];

const DeveloperWebsiteBuilder = () => {
  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <div className="dev-wb-heading">
            <h1 className="text-page-title">Website builder</h1>
            <p className="text-body-3 text-text-secondary">
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
            <span className="dev-wb-badge text-caption-2">Website builder</span>
            <p className="dev-wb-promo-title font-newsreader">
              Pick a template, connect the clinic&apos;s services, and{' '}
              <span className="dev-wb-promo-accent">appointments land straight in the PIMS.</span>
            </p>
            <p className="dev-wb-promo-body">Custom domain included. Bookings sync in real time.</p>
          </div>

          <h2 className="dev-wb-section-title text-heading-3 text-text-primary">Templates</h2>
          <div className="dev-wb-grid">
            {TEMPLATES.map((template) => (
              <div key={template.id} className="dev-wb-card">
                <span className="dev-wb-card-thumb" aria-hidden="true">
                  <Icon icon={template.icon} width={22} height={22} />
                </span>
                <h3 className="dev-wb-card-title text-body-3-emphasis text-text-primary">
                  {template.name}
                </h3>
                <p className="text-body-4 text-text-secondary dev-wb-card-desc">
                  {template.description}
                </p>
                <span className="dev-wb-card-action text-body-4-emphasis">Use template</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperWebsiteBuilder;
