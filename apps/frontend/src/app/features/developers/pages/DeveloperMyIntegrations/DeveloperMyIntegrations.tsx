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

const INTAKE_WORKFLOWS = [
  {
    id: '03.1',
    title: 'Pre-visit history',
    summary: 'Collect configurable history from a pet parent before an appointment.',
    entryPoint: 'Form configuration and appointment workspace',
    result: 'A timestamped response for staff to review',
    icon: 'ion:clipboard-outline',
  },
  {
    id: '03.2',
    title: 'Symptom follow-up',
    summary: 'Capture observations and route matching answers to a staff review task.',
    entryPoint: 'Appointment workspace',
    result: 'A non-diagnostic follow-up for staff review',
    icon: 'ion:chatbox-ellipses-outline',
  },
  {
    id: '03.3',
    title: 'Medication check-in',
    summary: 'Gather adherence, side-effect and refill information between visits.',
    entryPoint: 'Appointment workspace',
    result: 'A medication check-in beside the visit',
    icon: 'ion:medkit-outline',
  },
  {
    id: '03.4',
    title: 'Chronic-care diary',
    summary: 'Let pet parents record configured measures and notes over time.',
    entryPoint: 'Appointment workspace',
    result: 'A dated diary for clinical review',
    icon: 'ion:analytics-outline',
  },
  {
    id: '03.5',
    title: 'Discharge follow-up',
    summary: 'Schedule recovery questions after a visit and surface exceptions to staff.',
    entryPoint: 'Appointment workspace',
    result: 'A reviewed follow-up linked to the visit',
    icon: 'ion:heart-outline',
  },
  {
    id: '03.6',
    title: 'Preventive-care outreach',
    summary: 'Ask due-care cohorts for preparation details before normal booking.',
    entryPoint: 'Form configuration and appointment workspace',
    result: 'A response in the practice follow-up queue',
    icon: 'ion:calendar-outline',
  },
] as const;

type IntakeWorkflow = (typeof INTAKE_WORKFLOWS)[number];

const DeveloperMyIntegrations = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<IntakeWorkflow>();

  const openBlankDraft = () => {
    setSelectedWorkflow(undefined);
    setName('');
    setIsCreating(true);
  };
  const openWorkflowDraft = (workflow: IntakeWorkflow) => {
    setSelectedWorkflow(workflow);
    setName(workflow.title);
    setIsCreating(true);
  };
  const closeDraft = () => {
    setSelectedWorkflow(undefined);
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
            onClick={openBlankDraft}
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

        <section aria-labelledby="intake-workflows-title" className="flex flex-col gap-4">
          <div className="flex max-w-3xl flex-col gap-1">
            <span className="text-xs font-extrabold tracking-widest text-cyan-text uppercase">
              Workflow collection 03
            </span>
            <h2
              id="intake-workflows-title"
              className="m-0 font-newsreader text-[28px] font-normal text-text-primary"
            >
              Intake and continuing care
            </h2>
            <p className="m-0 text-sm leading-relaxed text-text-secondary">
              Start from a defined daily-care job, then adapt its questions, review point and
              practice handoff.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {INTAKE_WORKFLOWS.map((workflow) => (
              <Card
                key={workflow.id}
                className="group flex min-h-72 flex-col gap-4 overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between border-b border-card-border bg-[var(--inset)] px-5 py-3">
                  <span className="text-xs font-extrabold tracking-widest text-cyan-text">
                    {workflow.id}
                  </span>
                  <span
                    className="grid size-9 place-items-center rounded-xl bg-card-bg text-cyan-text shadow-[0_4px_14px_var(--sh08)]"
                    aria-hidden="true"
                  >
                    <Icon icon={workflow.icon} width={18} height={18} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-text-primary">
                      {workflow.title}
                    </h3>
                    <p className="mt-1 mb-0 text-sm leading-relaxed text-text-secondary">
                      {workflow.summary}
                    </p>
                  </div>
                  <dl className="m-0 grid gap-2 border-t border-card-border pt-3 text-xs">
                    <div>
                      <dt className="font-bold text-text-primary">Entry point</dt>
                      <dd className="m-0 mt-0.5 text-text-secondary">{workflow.entryPoint}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-text-primary">Visible result</dt>
                      <dd className="m-0 mt-0.5 text-text-secondary">{workflow.result}</dd>
                    </div>
                  </dl>
                  <Button
                    text={`Start with ${workflow.title}`}
                    variant="secondary"
                    className="mt-auto w-full"
                    onClick={() => openWorkflowDraft(workflow)}
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>

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
            onClick={openBlankDraft}
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
            {selectedWorkflow ? (
              <p className="m-0 rounded-xl bg-[var(--inset)] px-3.5 py-3 text-xs leading-relaxed text-text-secondary">
                Starting from <strong className="text-text-primary">{selectedWorkflow.id}</strong>
                {' · '}
                {selectedWorkflow.result}. You can rename the draft before opening the playground.
              </p>
            ) : null}
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
