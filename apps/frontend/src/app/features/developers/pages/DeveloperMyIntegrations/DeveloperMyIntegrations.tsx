'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/ui/icons/Icon';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import './DeveloperMyIntegrations.css';
import '@/app/features/organizations/styles/Organizations.css';

const STAGES = [
  {
    title: 'Shape the idea',
    copy: 'Name the workflow, audience and job it should complete.',
    icon: 'ion:bulb-outline',
  },
  {
    title: 'Preview safely',
    copy: 'Try requests in the API playground with a development key.',
    icon: 'ion:flask-outline',
  },
  {
    title: 'Run checks',
    copy: 'Review permissions, install steps and the screens people will use.',
    icon: 'ion:checkmark-circle-outline',
  },
  {
    title: 'Prepare a release',
    copy: 'Package the integration and document what changes for a practice.',
    icon: 'ion:rocket-outline',
  },
  {
    title: 'Install at a practice',
    copy: 'Hand the release to a practice administrator for installation.',
    icon: 'ion:business-outline',
  },
] as const;

const DeveloperMyIntegrations = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const closeDraft = () => setIsCreating(false);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper dev-workspace">
        <header className="dev-workspace-head">
          <div>
            <span className="dev-workspace-kicker">Builder workspace</span>
            <h1 className="text-page-title">My integrations</h1>
            <p>
              Move an integration from a clear idea to something a practice can install and use.
            </p>
          </div>
          <button
            type="button"
            className="dev-workspace-create"
            onClick={() => setIsCreating(true)}
          >
            <Icon icon="ion:add" width={17} height={17} aria-hidden="true" />
            New integration
          </button>
        </header>

        <section className="dev-workspace-path" aria-labelledby="build-path-title">
          <div className="dev-workspace-path-copy">
            <span>Start here</span>
            <h2 id="build-path-title" className="font-newsreader">
              A release path you can see end to end.
            </h2>
            <p>Each draft keeps the build work, safety checks and practice handoff in one place.</p>
            <Link href="/developers/documentation">Read the integration guide</Link>
          </div>
          <ol>
            {STAGES.map((stage, index) => (
              <li key={stage.title}>
                <span className="dev-workspace-stage-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="dev-workspace-stage-icon" aria-hidden="true">
                  <Icon icon={stage.icon} width={18} height={18} />
                </span>
                <span>
                  <strong>{stage.title}</strong>
                  <small>{stage.copy}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="dev-workspace-empty" aria-labelledby="integration-drafts-title">
          <span className="dev-workspace-empty-icon" aria-hidden="true">
            <Icon icon="ion:cube-outline" width={24} height={24} />
          </span>
          <h2 id="integration-drafts-title">No integration drafts yet</h2>
          <p>
            Create a draft to define its job and follow the release path. Draft saving will arrive
            with the integration project service.
          </p>
          <button type="button" onClick={() => setIsCreating(true)}>
            Start a draft
          </button>
        </section>

        <ModalBase
          showModal={isCreating}
          setShowModal={setIsCreating}
          aria-labelledby="new-integration-title"
          overlayClassName={`fixed inset-0 z-[5000] backdrop-blur-[2px] transition-opacity duration-200 ${
            isCreating ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          overlayStyle={{ backgroundColor: 'var(--sh55)' }}
          containerClassName={`dev-workspace-dialog ${
            isCreating ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="dev-workspace-dialog-card">
            <button
              type="button"
              className="dev-workspace-close"
              aria-label="Close"
              onClick={closeDraft}
            >
              ×
            </button>
            <span className="dev-workspace-kicker">New draft</span>
            <h2 id="new-integration-title" className="font-newsreader">
              What are you building?
            </h2>
            <label htmlFor="integration-name">Integration name</label>
            <input
              id="integration-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Lab result bridge"
            />
            <p>
              Draft persistence and the full editor depend on the integration project service. You
              can continue in the API playground today.
            </p>
            <div className="dev-workspace-dialog-actions">
              <button type="button" onClick={closeDraft}>
                Cancel
              </button>
              {name.trim().length > 0 ? (
                <Link href="/developers/playground">Open API playground</Link>
              ) : (
                <button type="button" disabled>
                  Open API playground
                </button>
              )}
            </div>
          </div>
        </ModalBase>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperMyIntegrations;
