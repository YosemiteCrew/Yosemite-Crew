'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  IoArrowForward,
  IoCheckmarkCircle,
  IoChevronForward,
  IoCodeSlashOutline,
  IoDesktopOutline,
  IoGitNetworkOutline,
  IoTerminalOutline,
} from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperConnect.css';

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

const DeveloperConnect = () => {
  const [selectedToolId, setSelectedToolId] = useState(TOOL_CHOICES[0].id);
  const [activeStep, setActiveStep] = useState(2);
  const selectedTool = TOOL_CHOICES.find((tool) => tool.id === selectedToolId) ?? TOOL_CHOICES[0];

  const chooseTool = (toolId: string) => {
    setSelectedToolId(toolId);
    setActiveStep(2);
  };

  return (
    <DevRouteGuard>
      <main className="DevConnect OperationsWrapper">
        <header className="DevConnectHeader">
          <span className="DevConnectEyebrow">Guided setup</span>
          <h1>Connect a coding tool</h1>
          <p>
            Follow one path from this signed-in developer account to a first read-only practice
            request.
          </p>
        </header>

        <div className="DevConnectLayout">
          <section
            className="DevConnectChooser yc-card-surface"
            aria-labelledby="tool-choice-title"
          >
            <div className="DevConnectSectionHead">
              <span className="DevConnectStepNumber" aria-hidden="true">
                1
              </span>
              <div>
                <h2 id="tool-choice-title">Choose your setup</h2>
                <p>The steps adapt to where your coding assistant runs.</p>
              </div>
            </div>
            <div className="DevConnectTools">
              {TOOL_CHOICES.map((tool) => {
                const selected = tool.id === selectedTool.id;
                const ToolIcon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`DevConnectTool${selected ? ' is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => chooseTool(tool.id)}
                  >
                    <span className="DevConnectToolIcon" aria-hidden="true">
                      <ToolIcon size={18} />
                    </span>
                    <span className="DevConnectToolCopy">
                      <strong>{tool.title}</strong>
                      <span>{tool.description}</span>
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
          </section>

          <section className="DevConnectJourney yc-card-surface" aria-labelledby="journey-title">
            <div className="DevConnectJourneyIntro">
              <div>
                <span className="DevConnectEyebrow">{selectedTool.title}</span>
                <h2 id="journey-title">Your connection journey</h2>
              </div>
              <span className="DevConnectTime">About 5 minutes</span>
            </div>

            <ol className="DevConnectSteps">
              <li className={activeStep === 2 ? 'is-active' : ''}>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  aria-current={activeStep === 2 ? 'step' : undefined}
                >
                  <span className="DevConnectStepNumber">2</span>
                  <span className="DevConnectStepLabel">
                    <strong>Confirm sign-in and create access</strong>
                    <span>This guide uses the developer account you are signed in with.</span>
                  </span>
                </button>
                {activeStep === 2 && (
                  <div className="DevConnectStepBody">
                    <p>Create a test API key and copy it when shown.</p>
                    <Link href="/developers/api-keys" className="DevConnectPrimaryLink">
                      Create an API key
                      <IoArrowForward size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="DevConnectTextButton"
                      onClick={() => setActiveStep(3)}
                    >
                      I have a key
                    </button>
                  </div>
                )}
              </li>

              <li className={activeStep === 3 ? 'is-active' : ''}>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  aria-current={activeStep === 3 ? 'step' : undefined}
                >
                  <span className="DevConnectStepNumber">3</span>
                  <span className="DevConnectStepLabel">
                    <strong>Add Yosemite Crew to your tool</strong>
                    <span>Open {selectedTool.setupLabel} and add a local MCP server.</span>
                  </span>
                </button>
                {activeStep === 3 && (
                  <div className="DevConnectStepBody">
                    <p>
                      Open the setup guide for the connection details, then add them to your tool.
                    </p>
                    <Link href="/developers/documentation" className="DevConnectSecondaryLink">
                      Open setup guide
                      <IoArrowForward size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="DevConnectPrimaryButton"
                      onClick={() => setActiveStep(4)}
                    >
                      Connection added
                    </button>
                  </div>
                )}
              </li>

              <li className={activeStep === 4 ? 'is-active' : ''}>
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  aria-current={activeStep === 4 ? 'step' : undefined}
                >
                  <span className="DevConnectStepNumber">4</span>
                  <span className="DevConnectStepLabel">
                    <strong>Choose a practice</strong>
                    <span>Discover the practices this account can read.</span>
                  </span>
                </button>
                {activeStep === 4 && (
                  <div className="DevConnectStepBody">
                    <p>
                      Ask your tool: “List the practices available to me.” Then choose one result.
                    </p>
                    <button
                      type="button"
                      className="DevConnectPrimaryButton"
                      onClick={() => setActiveStep(5)}
                    >
                      Practice chosen
                    </button>
                  </div>
                )}
              </li>

              <li className={activeStep === 5 ? 'is-active' : ''}>
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  aria-current={activeStep === 5 ? 'step' : undefined}
                >
                  <span className="DevConnectStepNumber">5</span>
                  <span className="DevConnectStepLabel">
                    <strong>Make a first test call</strong>
                    <span>Read upcoming appointments from the practice you chose.</span>
                  </span>
                </button>
                {activeStep === 5 && (
                  <div className="DevConnectStepBody">
                    <p>Ask your tool: “List the upcoming appointments for this practice.”</p>
                    <Link href="/developers/playground" className="DevConnectPrimaryLink">
                      Verify in API playground
                      <IoArrowForward size={15} aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </li>
            </ol>
          </section>
        </div>
      </main>
    </DevRouteGuard>
  );
};

export default DeveloperConnect;
