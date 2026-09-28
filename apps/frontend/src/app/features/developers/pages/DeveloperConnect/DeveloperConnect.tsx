'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import type { IconType } from 'react-icons';
import {
  IoCheckmarkCircle,
  IoChevronForward,
  IoCodeSlashOutline,
  IoDesktopOutline,
  IoGitNetworkOutline,
  IoTerminalOutline,
} from 'react-icons/io5';
import { Button, Card } from '@/app/ui';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

type ToolChoice = {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  setupLabel: string;
};

const TOOL_CHOICES: ToolChoice[] = [
  {
    id: 'terminal',
    title: 'Terminal agent',
    description: 'For a coding assistant that runs from your terminal.',
    icon: IoTerminalOutline,
    setupLabel: 'your agent configuration',
  },
  {
    id: 'desktop',
    title: 'Desktop assistant',
    description: 'For an installed assistant with local tool connections.',
    icon: IoDesktopOutline,
    setupLabel: 'the desktop connection settings',
  },
  {
    id: 'editor',
    title: 'Editor extension',
    description: 'For an assistant that works inside your code editor.',
    icon: IoCodeSlashOutline,
    setupLabel: 'the extension connection settings',
  },
  {
    id: 'other',
    title: 'Another MCP client',
    description: 'For any client that can start a local stdio server.',
    icon: IoGitNetworkOutline,
    setupLabel: 'your client MCP settings',
  },
];

const TOOL_SETUP_HREF = '/developers/playground?operation=listAppointments&export=mcp';

const DeveloperConnect = () => {
  const [selectedToolId, setSelectedToolId] = useState(TOOL_CHOICES[0].id);
  const [activeStep, setActiveStep] = useState(2);
  const selectedTool = TOOL_CHOICES.find((tool) => tool.id === selectedToolId) ?? TOOL_CHOICES[0];

  const chooseTool = (toolId: string) => {
    setSelectedToolId(toolId);
    setActiveStep(2);
  };

  const stepButtonClass =
    'flex w-full items-start gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text';
  const stepNumberClass =
    'inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-card-border bg-inset text-caption-2 font-bold text-text-primary';
  const stepLabelClass = 'flex flex-col gap-1';
  const stepTitleClass = 'text-caption-1 font-bold text-text-primary';
  const stepDetailClass = 'text-caption-2 text-text-tertiary';
  const stepBodyClass = 'mb-2 ml-10 rounded-r-xl border-l-2 border-blue-text bg-inset p-4';

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper flex flex-col gap-5 text-text-secondary">
        <header className="max-w-3xl">
          <span className="mb-1 block text-caption-2 font-bold uppercase tracking-wider text-blue-text">
            Guided setup
          </span>
          <h1 className="text-page-title text-text-primary">Connect a coding tool</h1>
          <p className="mt-2 max-w-2xl text-body-3 text-text-secondary">
            Follow one path from this signed-in developer account to a first read-only practice
            request.
          </p>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,0.78fr)_minmax(420px,1.45fr)]">
          <Card
            variant="bordered"
            className="p-4 sm:p-5"
            role="region"
            aria-labelledby="tool-choice-title"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-card-border bg-inset text-caption-2 font-bold text-text-primary">
                1
              </span>
              <div>
                <h2 id="tool-choice-title" className="text-body-2 font-bold text-text-primary">
                  Choose your setup
                </h2>
                <p className="mt-1 text-caption-1 text-text-tertiary">
                  The steps adapt to where your coding assistant runs.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 max-lg:grid max-lg:grid-cols-2 max-sm:grid-cols-1">
              {TOOL_CHOICES.map((tool) => {
                const selected = tool.id === selectedTool.id;
                const ToolIcon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={clsx(
                      'flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-text',
                      selected
                        ? 'border-blue-text bg-nav-active-bg text-blue-text'
                        : 'border-card-border bg-card-bg text-text-secondary hover:border-blue-text'
                    )}
                    aria-pressed={selected}
                    onClick={() => chooseTool(tool.id)}
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-inset text-blue-text">
                      <ToolIcon size={18} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="text-caption-1 font-bold text-text-primary">
                        {tool.title}
                      </strong>
                      <span className="text-caption-2 text-text-tertiary">{tool.description}</span>
                    </span>
                    {selected ? (
                      <IoCheckmarkCircle size={18} aria-hidden="true" />
                    ) : (
                      <IoChevronForward size={18} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card
            variant="bordered"
            className="p-4 sm:p-5"
            role="region"
            aria-labelledby="journey-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-card-border pb-4 max-sm:flex-col">
              <div>
                <span className="mb-1 block text-caption-2 font-bold uppercase tracking-wider text-blue-text">
                  {selectedTool.title}
                </span>
                <h2 id="journey-title" className="text-body-2 font-bold text-text-primary">
                  Your connection journey
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-inset px-3 py-1 text-caption-2 font-bold text-text-tertiary">
                About 5 minutes
              </span>
            </div>

            <ol className="pt-2">
              <li
                className={clsx(
                  'border-l border-card-border pl-4',
                  activeStep === 2 && 'border-blue-text'
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  aria-current={activeStep === 2 ? 'step' : undefined}
                  className={stepButtonClass}
                >
                  <span
                    className={clsx(
                      stepNumberClass,
                      activeStep === 2 && 'border-blue-text bg-blue-strong text-white'
                    )}
                  >
                    2
                  </span>
                  <span className={stepLabelClass}>
                    <strong className={stepTitleClass}>Confirm sign-in and create access</strong>
                    <span className={stepDetailClass}>
                      This guide uses the developer account you are signed in with.
                    </span>
                  </span>
                </button>
                {activeStep === 2 && (
                  <div className={stepBodyClass}>
                    <p className="mb-3 text-caption-1 text-text-secondary">
                      Create a test key for the guided appointment example. The form opens with the
                      settings needed for this call.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        href="/developers/api-keys?setup=appointment-test"
                        text="Create a test key"
                      />
                      <Button
                        variant="secondary"
                        text="I have a key"
                        onClick={() => setActiveStep(3)}
                      />
                    </div>
                  </div>
                )}
              </li>

              <li
                className={clsx(
                  'border-l border-card-border pl-4',
                  activeStep === 3 && 'border-blue-text'
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  aria-current={activeStep === 3 ? 'step' : undefined}
                  className={stepButtonClass}
                >
                  <span
                    className={clsx(
                      stepNumberClass,
                      activeStep === 3 && 'border-blue-text bg-blue-strong text-white'
                    )}
                  >
                    3
                  </span>
                  <span className={stepLabelClass}>
                    <strong className={stepTitleClass}>Add Yosemite Crew to your tool</strong>
                    <span className={stepDetailClass}>
                      Open {selectedTool.setupLabel} and add a local tool connection.
                    </span>
                  </span>
                </button>
                {activeStep === 3 && (
                  <div className={stepBodyClass}>
                    <p className="mb-3 text-caption-1 text-text-secondary">
                      Copy a ready-to-use connection and sample call from the setup export.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button href={TOOL_SETUP_HREF} text="Open connection setup" />
                      <Button
                        variant="secondary"
                        text="Connection added"
                        onClick={() => setActiveStep(4)}
                      />
                    </div>
                  </div>
                )}
              </li>

              <li
                className={clsx(
                  'border-l border-card-border pl-4',
                  activeStep === 4 && 'border-blue-text'
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  aria-current={activeStep === 4 ? 'step' : undefined}
                  className={stepButtonClass}
                >
                  <span
                    className={clsx(
                      stepNumberClass,
                      activeStep === 4 && 'border-blue-text bg-blue-strong text-white'
                    )}
                  >
                    4
                  </span>
                  <span className={stepLabelClass}>
                    <strong className={stepTitleClass}>Choose a practice</strong>
                    <span className={stepDetailClass}>
                      Discover the practices this account can read.
                    </span>
                  </span>
                </button>
                {activeStep === 4 && (
                  <div className={stepBodyClass}>
                    <p className="mb-3 text-caption-1 text-text-secondary">
                      Ask your tool: “List the practices available to me.” Then choose one result.
                    </p>
                    <Button
                      variant="secondary"
                      text="Practice chosen"
                      onClick={() => setActiveStep(5)}
                    />
                  </div>
                )}
              </li>

              <li
                className={clsx(
                  'border-l border-transparent pl-4',
                  activeStep === 5 && 'border-blue-text'
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  aria-current={activeStep === 5 ? 'step' : undefined}
                  className={stepButtonClass}
                >
                  <span
                    className={clsx(
                      stepNumberClass,
                      activeStep === 5 && 'border-blue-text bg-blue-strong text-white'
                    )}
                  >
                    5
                  </span>
                  <span className={stepLabelClass}>
                    <strong className={stepTitleClass}>Make a first test call</strong>
                    <span className={stepDetailClass}>
                      Read upcoming appointments from the practice you chose.
                    </span>
                  </span>
                </button>
                {activeStep === 5 && (
                  <div className={stepBodyClass}>
                    <p className="mb-3 text-caption-1 text-text-secondary">
                      Ask your tool: “List the upcoming appointments for this practice.”
                    </p>
                    <Button href={TOOL_SETUP_HREF} text="Verify in API playground" />
                  </div>
                )}
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperConnect;
