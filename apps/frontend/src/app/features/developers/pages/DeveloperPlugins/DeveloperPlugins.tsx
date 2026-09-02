'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/app/ui/icons/Icon';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperPlugins.css';
import '@/app/features/organizations/styles/Organizations.css';

type PluginStatus = 'sample';

type PluginCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  status: PluginStatus;
  author: string;
};

/*
 * Illustrations of the kind of integration the catalog is for, not a catalog.
 *
 * These cards used to carry adoption figures - "Installed · 412 clinics" and
 * "Installed · 1,208 clinics" - against IDEXX and MSD, two real companies, plus
 * a named author and version for a third. Nothing counts installs, because
 * there is no plugin model in the schema and no plugin endpoint in the backend.
 * A "coming soon" line at the top of the page does not neutralise a specific
 * claim about a named third party further down it, so the claims are gone
 * rather than merely disclaimed.
 */
const PLUGINS: PluginCard[] = [
  {
    id: 'lab-bridge',
    title: 'Lab result bridge',
    description: 'Order lab work and read results inside the appointment workspace.',
    icon: 'ion:flask-outline',
    badge: 'Sample',
    status: 'sample',
    author: 'Example of a diagnostics integration',
  },
  {
    id: 'clinical-reference',
    title: 'Clinical reference',
    description: 'Read a veterinary reference from the workspace side rail.',
    icon: 'ion:book-outline',
    badge: 'Sample',
    status: 'sample',
    author: 'Example of a reference integration',
  },
  {
    id: 'monitor-sync',
    title: 'Monitor sync',
    description: 'Stream vitals from theatre monitors into the workspace.',
    icon: 'ion:pulse-outline',
    badge: 'Sample',
    status: 'sample',
    author: 'Example of a device integration',
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
            <p className="dev-plugins-subtitle">
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
          Preview · the plugin catalog and submission flow are coming soon. The cards below are
          illustrations, not installed integrations.
        </p>

        <section className="DevPlugins">
          <div className="dev-plugins-grid">
            {PLUGINS.map((plugin) => (
              <div key={plugin.id} className="dev-plugin-card">
                <div className="dev-plugin-card-head">
                  <span className="dev-plugin-card-icon" aria-hidden="true">
                    <Icon icon={plugin.icon} width={18} height={18} />
                  </span>
                  <span className={`dev-plugin-badge ${plugin.status} text-caption-3`}>
                    {plugin.badge}
                  </span>
                </div>
                <h2 className="dev-plugin-card-title">{plugin.title}</h2>
                <p className="dev-plugin-card-desc">{plugin.description}</p>
                <div className="dev-plugin-card-foot">
                  <span className="dev-plugin-card-author">{plugin.author}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="dev-website-card">
            <div className="dev-website-copy">
              <span className="dev-website-badge text-caption-3">Website builder</span>
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
                <span className="dev-site-status">
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
