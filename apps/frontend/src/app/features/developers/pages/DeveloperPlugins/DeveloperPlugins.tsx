'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperPlugins.css';
import '@/app/features/organizations/styles/Organizations.css';

type PluginStatus = 'installed' | 'in-review';

type PluginCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  status: PluginStatus;
  author: string;
  action: string;
};

const PLUGINS: PluginCard[] = [
  {
    id: 'idexx-lab-bridge',
    title: 'IDEXX lab bridge',
    description: 'Order and result IDEXX lab work inside the appointment workspace.',
    icon: 'ion:flask-outline',
    badge: 'Installed · 412 clinics',
    status: 'installed',
    author: 'by Yosemite Crew · v2.3',
    action: 'Manage',
  },
  {
    id: 'msd-vet-manual',
    title: 'MSD Vet Manual',
    description: 'Reference the veterinary manual from the workspace side rail.',
    icon: 'ion:book-outline',
    badge: 'Installed · 1,208 clinics',
    status: 'installed',
    author: 'by Yosemite Crew · v1.8',
    action: 'Manage',
  },
  {
    id: 'anesthesia-monitor-sync',
    title: 'Anesthesia monitor sync',
    description: 'Your submission. It streams Mindray vitals into the workspace.',
    icon: 'ion:pulse-outline',
    badge: 'In review',
    status: 'in-review',
    author: 'by Jonas Timm · v0.4.1',
    action: 'Review status',
  },
];

const SITE_SPECIES = [
  { src: '/images/developers/species-dog.png', key: 'dog' },
  { src: '/images/developers/species-cat.png', key: 'cat' },
  { src: '/images/developers/species-horse.png', key: 'horse' },
];

const DeveloperPlugins = () => {
  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <div className="dev-plugins-heading">
            <h1 className="text-page-title">Plugins</h1>
            <p className="text-body-3 text-text-secondary">
              Extend every clinic on the platform. The WordPress model, for animal health
            </p>
          </div>
          <Primary
            text="Submit a plugin"
            icon={
              <Icon icon="ion:cloud-upload-outline" width={16} height={16} aria-hidden="true" />
            }
            href="/contact-us"
            style={{ maxWidth: 200 }}
          />
        </div>

        <p className="dev-plugins-preview text-caption-2">
          Preview · the plugin catalog and submission flow are coming soon.
        </p>

        <section className="DevPlugins">
          <div className="dev-plugins-grid">
            {PLUGINS.map((plugin) => (
              <div key={plugin.id} className="dev-plugin-card">
                <div className="dev-plugin-card-head">
                  <span className="dev-plugin-card-icon" aria-hidden="true">
                    <Icon icon={plugin.icon} width={18} height={18} />
                  </span>
                  <span className={`dev-plugin-badge ${plugin.status} text-caption-2`}>
                    {plugin.badge}
                  </span>
                </div>
                <h2 className="dev-plugin-card-title text-heading-3 text-text-primary">
                  {plugin.title}
                </h2>
                <p className="text-body-4 text-text-secondary dev-plugin-card-desc">
                  {plugin.description}
                </p>
                <div className="dev-plugin-card-foot">
                  <span className="text-caption-2 text-text-tertiary">{plugin.author}</span>
                  <span className="dev-plugin-card-action text-body-4-emphasis">
                    {plugin.action}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="dev-website-card">
            <div className="dev-website-copy">
              <span className="dev-website-badge text-caption-2">Website builder</span>
              <p className="dev-website-title font-newsreader">
                A clinic website with booking built in,{' '}
                <span className="dev-website-title-accent">live in an afternoon.</span>
              </p>
              <p className="dev-website-body">
                Pick a template, connect the clinic&apos;s services, and appointments land straight
                in the PIMS. Custom domain included.
              </p>
              <div className="dev-website-actions">
                <Link href="/developers/website-builder" className="dev-website-cta primary">
                  Open builder
                </Link>
                <Link href="/developers/website-builder" className="dev-website-cta ghost">
                  See templates
                </Link>
              </div>
            </div>
            <div className="dev-site-preview">
              <div className="dev-site-chrome">
                <span className="dev-site-dot" aria-hidden="true" />
                <span className="dev-site-dot" aria-hidden="true" />
                <span className="dev-site-dot" aria-hidden="true" />
                <span className="dev-site-url">alpenblick.vet</span>
              </div>
              <div className="dev-site-body">
                <div className="dev-site-topbar">
                  <span className="dev-site-brand text-text-primary">Alpenblick Animal Clinic</span>
                  <span className="dev-site-book">Book appointment</span>
                </div>
                <p className="dev-site-headline font-newsreader text-text-primary">
                  Care for the animals of Garmisch
                </p>
                <div className="dev-site-species">
                  {SITE_SPECIES.map((species) => (
                    <span key={species.key} className="dev-site-species-tile" aria-hidden="true">
                      <Image
                        src={species.src}
                        alt=""
                        width={26}
                        height={26}
                        className="dev-site-species-photo"
                      />
                    </span>
                  ))}
                </div>
                <span className="dev-site-status text-caption-2 text-text-tertiary">
                  <span className="dev-dot" aria-hidden="true" />
                  {'Bookings sync to the PIMS in real time'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPlugins;
