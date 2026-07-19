'use client';
import React, { useState } from 'react';
import { Icon } from '@iconify/react';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperApiKeys.css';
import '@/app/features/organizations/styles/Organizations.css';

type KeyEnvironment = 'sandbox' | 'production';
type KeyStatus = 'active' | 'revoked';

type ApiKeyRow = {
  id: string;
  name: string;
  maskedKey: string;
  environment: KeyEnvironment;
  created: string;
  lastUsed: string;
  status: KeyStatus;
};

const SAMPLE_KEYS: ApiKeyRow[] = [
  {
    id: 'monitor-sync',
    name: 'Monitor sync · sandbox',
    maskedKey: 'yc_sand_9f2K…D41x',
    environment: 'sandbox',
    created: 'Today · 09:41',
    lastUsed: 'Just now',
    status: 'active',
  },
  {
    id: 'booking-widget',
    name: 'Booking widget · prod',
    maskedKey: 'yc_live_4hTe…9samp',
    environment: 'production',
    created: '12 May 2026',
    lastUsed: '2 min ago',
    status: 'active',
  },
  {
    id: 'legacy-import',
    name: 'Legacy import script',
    maskedKey: 'yc_sand_77Qa…mm20',
    environment: 'sandbox',
    created: '03 Feb 2026',
    lastUsed: 'Apr 2026',
    status: 'revoked',
  },
];

const ENVIRONMENT_LABEL: Record<KeyEnvironment, string> = {
  sandbox: 'Sandbox',
  production: 'Production',
};

const STATUS_LABEL: Record<KeyStatus, string> = {
  active: 'Active',
  revoked: 'Revoked',
};

const USAGE_BARS = [
  { day: 'Mon', value: 45 },
  { day: 'Tue', value: 60 },
  { day: 'Wed', value: 38 },
  { day: 'Thu', value: 72 },
  { day: 'Fri', value: 55 },
  { day: 'Sat', value: 84 },
  { day: 'Sun', value: 66 },
];
const REVEALED_KEY = 'yc_sand_9f2K…D41x_monitor';

const copyToClipboard = (value: string) => {
  void globalThis.navigator?.clipboard?.writeText?.(value);
};

const DeveloperApiKeys = () => {
  const [showReveal, setShowReveal] = useState(true);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <div className="dev-keys-heading">
            <h1 className="text-page-title">API keys</h1>
            <p className="text-body-3 text-text-secondary">
              Keys are scoped per environment and shown only once
            </p>
          </div>
          <Primary
            text="Create key"
            icon={<Icon icon="ion:add" width={16} height={16} aria-hidden="true" />}
            onClick={() => setShowReveal(true)}
            style={{ maxWidth: 180 }}
          />
        </div>

        <p className="dev-keys-preview text-caption-2">
          Preview · key management API is coming soon. The keys below are sample data.
        </p>

        <section className="DevApiKeys">
          {showReveal && (
            <div className="dev-key-reveal" data-testid="dev-key-reveal">
              <span className="dev-key-reveal-icon" aria-hidden="true">
                <Icon icon="ion:key-outline" width={18} height={18} />
              </span>
              <span className="dev-key-reveal-body">
                <span className="dev-key-reveal-title">
                  &quot;Monitor sync · sandbox&quot; created. Copy it now, it won&apos;t be shown
                  again
                </span>
                <span className="dev-key-reveal-value">{REVEALED_KEY}</span>
              </span>
              <button
                type="button"
                className="dev-key-copy"
                onClick={() => copyToClipboard(REVEALED_KEY)}
              >
                <Icon icon="ion:copy-outline" width={14} height={14} aria-hidden="true" />
                Copy key
              </button>
              <button
                type="button"
                className="dev-key-reveal-dismiss"
                aria-label="Dismiss new key banner"
                onClick={() => setShowReveal(false)}
              >
                <Icon icon="ion:close" width={16} height={16} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="dev-keys-table">
            <div className="dev-keys-row dev-keys-head text-caption-2">
              <span>Name</span>
              <span>Key</span>
              <span>Environment</span>
              <span>Created</span>
              <span>Last used</span>
              <span>Status</span>
            </div>
            {SAMPLE_KEYS.map((row) => (
              <div
                key={row.id}
                className={`dev-keys-row ${row.status === 'revoked' ? 'is-revoked' : ''}`}
              >
                <span className="dev-key-name text-body-4-emphasis text-text-primary">
                  {row.name}
                </span>
                <span className="dev-key-value">{row.maskedKey}</span>
                <span>
                  <span className={`dev-env-badge ${row.environment} text-caption-2`}>
                    {ENVIRONMENT_LABEL[row.environment]}
                  </span>
                </span>
                <span className="dev-key-muted text-body-4">{row.created}</span>
                <span className="dev-key-muted text-body-4">{row.lastUsed}</span>
                <span>
                  <span className={`dev-key-status ${row.status} text-caption-2`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </span>
              </div>
            ))}

            <div className="dev-keys-usage">
              <span className="dev-keys-usage-label text-caption-2">Requests · 7 days</span>
              <span className="dev-keys-usage-bars" aria-hidden="true">
                {USAGE_BARS.map((bar) => (
                  <span
                    key={bar.day}
                    className="dev-keys-usage-bar"
                    style={{ height: `${bar.value}%` }}
                  />
                ))}
              </span>
              <span className="dev-keys-usage-total text-body-4-emphasis text-text-primary dev-tabular">
                27,904 <span className="text-caption-2 text-text-tertiary">total</span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperApiKeys;
