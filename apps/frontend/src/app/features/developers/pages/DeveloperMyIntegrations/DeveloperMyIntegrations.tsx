'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/ui/icons/Icon';
import { Button, Card, Input, PrimaryButton } from '@/app/ui';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
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
  const closeDraft = () => {
    setName('');
    setIsCreating(false);
  };

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper flex flex-col gap-6">
        <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-extrabold tracking-widest text-cyan-text uppercase">
              Builder workspace
            </span>
            <h1 className="m-0 text-page-title">My integrations</h1>
            <p className="m-0 mt-1.5 text-sm text-text-secondary">
              Move an integration from a clear idea to something a practice can install and use.
            </p>
          </div>
          <PrimaryButton
            text="New integration"
            icon={<Icon icon="ion:add" width={17} height={17} aria-hidden="true" />}
            size="small"
            className="!bg-[var(--blue-strong)] !text-white"
            onClick={() => setIsCreating(true)}
          />
        </header>

        <Card
          className="grid grid-cols-1 overflow-hidden shadow-[0_14px_40px_var(--sh08)] lg:grid-cols-[minmax(220px,0.75fr)_minmax(420px,1.55fr)]"
          aria-labelledby="build-path-title"
        >
          <div className="flex flex-col items-start justify-center gap-2.5 bg-[var(--spot)] p-6 text-[var(--spot-ink)] md:p-7">
            <span className="text-xs font-extrabold tracking-widest text-[var(--color-cyan)] uppercase">
              Start here
            </span>
            <h2
              id="build-path-title"
              className="m-0 font-newsreader text-2xl leading-tight font-normal md:text-[28px]"
            >
              A release path you can see end to end.
            </h2>
            <p className="m-0 text-sm leading-relaxed text-[color-mix(in_srgb,var(--spot-ink)_72%,transparent)]">
              Each draft keeps the build work, safety checks and practice handoff in one place.
            </p>
            <Link
              className="text-xs font-extrabold text-[var(--color-cyan)] no-underline"
              href="/developers/documentation"
            >
              Read the integration guide
            </Link>
          </div>
          <ol className="m-0 list-none px-5 py-3 md:px-6">
            {STAGES.map((stage, index) => (
              <li
                key={stage.title}
                className="grid grid-cols-[34px_40px_minmax(0,1fr)] items-center gap-2.5 border-b border-card-border py-3 last:border-0"
              >
                <span className="text-[10px] font-extrabold text-text-secondary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className="grid size-9 place-items-center rounded-xl bg-[var(--nav-active-bg)] text-cyan-text"
                  aria-hidden="true"
                >
                  <Icon icon={stage.icon} width={18} height={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <strong className="text-sm text-text-primary">{stage.title}</strong>
                  <small className="text-xs leading-snug text-text-secondary">{stage.copy}</small>
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <section
          className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-card-border bg-[var(--inset)] p-7 text-center"
          aria-labelledby="integration-drafts-title"
        >
          <span
            className="grid size-12 place-items-center rounded-2xl bg-card-bg text-cyan-text shadow-[0_5px_18px_var(--sh08)]"
            aria-hidden="true"
          >
            <Icon icon="ion:cube-outline" width={24} height={24} />
          </span>
          <h2
            id="integration-drafts-title"
            className="mt-3.5 mb-1 text-base font-semibold text-text-primary"
          >
            No integration drafts yet
          </h2>
          <p className="m-0 mb-4 max-w-[520px] text-sm leading-relaxed text-text-secondary">
            Create a draft to define its job and follow the release path. Draft saving will arrive
            with the integration project service.
          </p>
          <Button
            text="Start a draft"
            className="!bg-[var(--blue-strong)] !text-white"
            onClick={() => setIsCreating(true)}
          />
        </section>

        <ModalBase
          showModal={isCreating}
          setShowModal={setIsCreating}
          onClose={closeDraft}
          aria-labelledby="new-integration-title"
          overlayClassName={`fixed inset-0 z-5000 bg-[var(--sh55)] backdrop-blur-sm transition-opacity duration-200 ${
            isCreating ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          containerClassName={`fixed top-1/2 left-1/2 z-5001 w-[calc(100vw-2.5rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 ${
            isCreating ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <Card className="relative flex flex-col gap-3 p-6 shadow-[0_24px_80px_var(--sh20)] md:p-7">
            <button
              type="button"
              className="absolute top-3.5 right-3.5 border-0 bg-transparent p-0 text-2xl text-text-secondary"
              aria-label="Close"
              onClick={closeDraft}
            >
              ×
            </button>
            <span className="text-xs font-extrabold tracking-widest text-cyan-text uppercase">
              New draft
            </span>
            <h2
              id="new-integration-title"
              className="m-0 font-newsreader text-2xl font-normal text-text-primary"
            >
              What are you building?
            </h2>
            <label className="mt-1 text-sm font-bold text-text-primary" htmlFor="integration-name">
              Integration name
            </label>
            <Input
              id="integration-name"
              placeholder="Example: Lab result bridge"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="m-0 text-xs leading-relaxed text-text-secondary">
              Draft persistence and the full editor depend on the integration project service. You
              can continue in the API playground today.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button text="Cancel" variant="secondary" onClick={closeDraft} />
              {name.trim() ? (
                <Button text="Open API playground" href="/developers/playground" />
              ) : (
                <Button text="Open API playground" isDisabled />
              )}
            </div>
          </Card>
        </ModalBase>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperMyIntegrations;
