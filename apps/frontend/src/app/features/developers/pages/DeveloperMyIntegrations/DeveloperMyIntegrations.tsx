'use client';
import React, { useState } from 'react';

import { Icon } from '@/app/ui/icons/Icon';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { useAuthStore } from '@/app/stores/authStore';

import './DeveloperMyIntegrations.css';
import '@/app/features/organizations/styles/Organizations.css';

type IntegrationStatus = 'draft' | 'review' | 'published' | 'installed';

type DeveloperIntegration = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  version: string;
  updatedAt: string;
  installs?: number;
};

const MOCK_INTEGRATIONS: DeveloperIntegration[] = [
  {
    id: '1',
    name: 'Lab Result Bridge',
    description: 'Order lab work and read results inside the appointment workspace.',
    category: 'Diagnostics',
    status: 'published',
    version: '1.2.0',
    updatedAt: '2026-09-15',
    installs: 412,
  },
  {
    id: '2',
    name: 'Clinical Reference',
    description: 'Read a veterinary reference from the workspace side rail.',
    category: 'Clinical Assistance',
    status: 'draft',
    version: '0.1.0',
    updatedAt: '2026-09-20',
  },
  {
    id: '3',
    name: 'Monitor Sync',
    description: 'Stream vitals from theatre monitors into the workspace.',
    category: 'Connected Devices',
    status: 'review',
    version: '0.9.0',
    updatedAt: '2026-09-10',
  },
];

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; className: string; icon: string }> =
  {
    draft: { label: 'Draft', className: 'status-draft', icon: 'ion:document-outline' },
    review: { label: 'In Review', className: 'status-review', icon: 'ion:eye-outline' },
    published: {
      label: 'Published',
      className: 'status-published',
      icon: 'ion:checkmark-circle-outline',
    },
    installed: { label: 'Installed', className: 'status-installed', icon: 'ion:download-outline' },
  };

const CATEGORIES = [
  'Clinical Assistance',
  'Voice & Clinical Document',
  'Intake & Continuing Care',
  'Website & Client Portal',
  'Reception & Communication',
  'Finance & Practice Operations',
  'Diagnostics & Connected Devices',
  'Analytics & Controlled Export',
  'Knowledge & Configuration',
  'Partner & Commerce',
];

const DeveloperMyIntegrations = () => {
  const { attributes } = useAuthStore();
  const [integrations] = useState<DeveloperIntegration[]>(MOCK_INTEGRATIONS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [newIntegrationCategory, setNewIntegrationCategory] = useState(CATEGORIES[0]);

  const _displayName =
    `${attributes?.given_name || ''} ${attributes?.family_name || ''}`.trim() ||
    attributes?.email ||
    'Developer';

  const handleCreate = () => {
    if (!newIntegrationName.trim()) return;
    const newIntegration: DeveloperIntegration = {
      id: String(Date.now()),
      name: newIntegrationName.trim(),
      description: '',
      category: newIntegrationCategory,
      status: 'draft',
      version: '0.0.1',
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setIntegrations([newIntegration, ...integrations]);
    setShowCreateModal(false);
    setNewIntegrationName('');
  };

  const getStatusConfig = (status: IntegrationStatus) => STATUS_CONFIG[status];

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer dev-my-integrations-head">
          <div className="dev-my-integrations-intro">
            <h1 className="text-page-title">My Integrations</h1>
            <p className="dev-my-integrations-subtitle">
              Build, test, and publish integrations that extend every clinic on the platform
            </p>
          </div>
          <Primary
            text="Create integration"
            icon={<Icon icon="ion:add-outline" width={16} height={16} aria-hidden="true" />}
            onClick={() => setShowCreateModal(true)}
            style={{ maxWidth: 200 }}
          />
        </div>

        <section className="DevMyIntegrations">
          <div className="dev-my-integrations-grid">
            {integrations.length === 0 ? (
              <div className="dev-my-integrations-empty">
                <Icon
                  icon="ion:cube-outline"
                  width={48}
                  height={48}
                  className="dev-empty-icon"
                  aria-hidden="true"
                />
                <h2>No integrations yet</h2>
                <p>
                  Create your first integration to start building for the Yosemite Crew platform.
                </p>
                <Primary
                  text="Create integration"
                  icon={<Icon icon="ion:add-outline" width={16} height={16} aria-hidden="true" />}
                  onClick={() => setShowCreateModal(true)}
                />
              </div>
            ) : (
              integrations.map((integration) => {
                const statusConfig = getStatusConfig(integration.status);
                return (
                  <div key={integration.id} className="dev-integration-card">
                    <div className="dev-integration-card-head">
                      <div className="dev-integration-meta">
                        <span className="dev-integration-category">{integration.category}</span>
                        <span className={`dev-integration-status ${statusConfig.className}`}>
                          <Icon
                            icon={statusConfig.icon}
                            width={12}
                            height={12}
                            aria-hidden="true"
                          />
                          {statusConfig.label}
                        </span>
                      </div>
                      <span className="dev-integration-version">v{integration.version}</span>
                    </div>
                    <h2 className="dev-integration-title">{integration.name}</h2>
                    <p className="dev-integration-description">
                      {integration.description || 'No description yet'}
                    </p>
                    <div className="dev-integration-foot">
                      <span className="dev-integration-updated">
                        Updated {integration.updatedAt}
                      </span>
                      {integration.installs !== undefined && (
                        <span className="dev-integration-installs">
                          <Icon
                            icon="ion:people-outline"
                            width={12}
                            height={12}
                            aria-hidden="true"
                          />
                          {integration.installs.toLocaleString()} installs
                        </span>
                      )}
                    </div>
                    <div className="dev-integration-actions">
                      <Secondary
                        text={integration.status === 'draft' ? 'Continue building' : 'View details'}
                        icon={
                          <Icon
                            icon="ion:arrow-forward-outline"
                            width={14}
                            height={14}
                            aria-hidden="true"
                          />
                        }
                        onClick={() => {}}
                      />
                      {integration.status !== 'draft' && (
                        <Secondary text="Manage" variant="ghost" onClick={() => {}} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {showCreateModal && (
          <div className="dev-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create new integration</h2>
              <p className="dev-modal-description">
                Start building an integration that clinics can install and use in their daily
                workflow.
              </p>
              <div className="dev-modal-field">
                <label htmlFor="integration-name">Integration name</label>
                <input
                  id="integration-name"
                  type="text"
                  value={newIntegrationName}
                  onChange={(e) => setNewIntegrationName(e.target.value)}
                  placeholder="e.g., Smart Appointment Reminders"
                  autoFocus
                />
              </div>
              <div className="dev-modal-field">
                <label htmlFor="integration-category">Category</label>
                <select
                  id="integration-category"
                  value={newIntegrationCategory}
                  onChange={(e) => setNewIntegrationCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dev-modal-actions">
                <Secondary text="Cancel" onClick={() => setShowCreateModal(false)} />
                <Primary
                  text="Create integration"
                  onClick={handleCreate}
                  disabled={!newIntegrationName.trim()}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperMyIntegrations;
