'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IoArrowBack,
  IoBulbOutline,
  IoCopyOutline,
  IoLogoGithub,
  IoSearchOutline,
} from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperDocs.css';

const DOCS_BASE_PATH = '/dev-docs/index.html';
const GITHUB_EDIT_URL = 'https://github.com/YosemiteCrew/Yosemite-Crew/tree/dev/apps/dev-docs';

type NavItem = { id: string; label: string };
type NavSection = { heading: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    heading: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'appointments', label: 'Appointments API' },
      { id: 'patients', label: 'Patients API' },
      { id: 'webhooks', label: 'Webhooks' },
    ],
  },
  {
    heading: 'Guides',
    items: [
      { id: 'plugin', label: 'Build a plugin' },
      { id: 'fhir', label: 'FHIR resources' },
    ],
  },
];

type Article = {
  category: string;
  crumb: string;
  version: string;
  title: string;
  summary: string;
};

const ARTICLES: Record<string, Article> = {
  overview: {
    category: 'Getting started',
    crumb: 'Overview',
    version: 'v2 · STABLE',
    title: 'Overview',
    summary:
      'The Yosemite Crew API lets integrations read and write clinical data over a FHIR R4 surface. Start with authentication, then explore the Appointments and Patients resources.',
  },
  authentication: {
    category: 'Getting started',
    crumb: 'Authentication',
    version: 'v2 · STABLE',
    title: 'Authentication',
    summary:
      'Requests are authorized with a scoped bearer key. Create a key in the developer portal and send it as an Authorization header on every request.',
  },
  appointments: {
    category: 'APIs',
    crumb: 'Appointments',
    version: 'v2 · STABLE',
    title: 'Create an appointment',
    summary:
      "Creates a booking request in the clinic's schedule. The request lands in the clinic's Appointments board and follows the same confirmation flow as the public booking page.",
  },
  patients: {
    category: 'APIs',
    crumb: 'Patients',
    version: 'v2 · STABLE',
    title: 'Patients API',
    summary:
      'Read and write patient records as FHIR R4 Patient resources. Anything written here reads back identically from the FHIR endpoint.',
  },
  webhooks: {
    category: 'Getting started',
    crumb: 'Webhooks',
    version: 'v2 · STABLE',
    title: 'Webhooks',
    summary:
      'Subscribe to platform events and receive signed deliveries at your endpoint. Verify the signature with your signing secret before acting on a payload.',
  },
  plugin: {
    category: 'Guides',
    crumb: 'Build a plugin',
    version: 'GUIDE',
    title: 'Build a plugin',
    summary:
      'Package your integration as a plugin so clinics can install it in a few clicks. This guide walks through scaffolding, scopes, and submission.',
  },
  fhir: {
    category: 'Guides',
    crumb: 'FHIR resources',
    version: 'GUIDE',
    title: 'FHIR resources',
    summary:
      'Every clinical object on the platform maps to a FHIR R4 resource. This reference lists the supported resources and their compatibility notes.',
  },
};

const CURL_SAMPLE = String.raw`curl -X POST \
  https://api.yosemitecrew.com/v2/appointments \
  -H "Authorization: Bearer $YC_KEY" \
  -d '{
    "patient": "Patient/pat_poppy_812",
    "serviceType": "wellness",
    "start": "2026-07-17T10:30:00+02:00",
    "comment": "Ear recheck + ALP"
  }'`;

const RESPONSE_SAMPLE = `{
  "resourceType": "Appointment",
  "id": "apt_9k2f",
  "status": "proposed"
}`;

const copyText = async (value: string): Promise<boolean> => {
  try {
    const clip = globalThis.navigator?.clipboard;
    if (clip?.writeText) {
      await clip.writeText(value);
      return true;
    }
  } catch {
    // Clipboard is unavailable or blocked — fall through to the graceful no-op.
  }
  return false;
};

const DeveloperDocs = () => {
  const [activeId, setActiveId] = useState('appointments');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const active = ARTICLES[activeId];
  const isAppointments = activeId === 'appointments';

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const handleCopy = (key: string, value: string) => {
    void copyText(value).then((ok) => {
      if (ok) setCopiedKey(key);
    });
  };

  const pageText = `${active.title}\n\n${active.summary}`;

  return (
    <DevRouteGuard>
      <section className="DocsWrapper">
        <div className="DocsHeader">
          <Link href="/developers/home" className="DocsBackLink text-body-4-emphasis">
            <IoArrowBack size={18} />
            <span>Back to portal</span>
          </Link>
          <a
            className="DocsOpenLink text-body-4-emphasis text-text-brand"
            href={DOCS_BASE_PATH}
            target="_blank"
            rel="noreferrer"
          >
            Open full docs
          </a>
        </div>

        <div className="DocsShell">
          <nav className="DocsNav" aria-label="Documentation">
            <div className="DocsNavBrand">
              <div className="DocsNavBrandText">
                <span className="DocsNavBrandTitle">Docs</span>
                <span className="DocsNavBrandKicker">Developer</span>
              </div>
            </div>
            <div className="DocsSearch">
              <IoSearchOutline size={13} aria-hidden="true" />
              <input
                className="DocsSearchInput"
                type="search"
                placeholder="Search docs"
                aria-label="Search docs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {filteredNav.length === 0 ? (
              <div className="DocsNavEmpty">No matches</div>
            ) : (
              filteredNav.map((section, index) => (
                <React.Fragment key={section.heading}>
                  <span className={`DocsNavSection${index > 0 ? ' spaced' : ''}`}>
                    {section.heading}
                  </span>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`DocsNavItem${item.id === activeId ? ' is-active' : ''}`}
                      aria-current={item.id === activeId ? 'page' : undefined}
                      onClick={() => setActiveId(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </React.Fragment>
              ))
            )}

            <a className="DocsNavGithub" href={GITHUB_EDIT_URL} target="_blank" rel="noreferrer">
              <IoLogoGithub size={14} />
              Edit on GitHub
            </a>
          </nav>

          <div className="DocsMain">
            <div className="DocsMainHead">
              <span className="DocsBreadcrumb">
                Docs / {active.category} / <strong>{active.crumb}</strong>
              </span>
              <span className="DocsMainHeadActions">
                <span className="DocsVersionBadge">{active.version}</span>
                <button
                  type="button"
                  className="DocsCopyBtn"
                  onClick={() => handleCopy('page', pageText)}
                >
                  <IoCopyOutline size={12} aria-hidden="true" />
                  {copiedKey === 'page' ? 'Copied' : 'Copy page'}
                </button>
              </span>
            </div>

            <div className="DocsBody">
              <article className="DocsArticle">
                <h3 className="DocsArticleTitle">{active.title}</h3>
                <p className="DocsArticleText">{active.summary}</p>

                {isAppointments ? (
                  <>
                    <div className="DocsEndpoint">
                      <span className="DocsMethod">POST</span>
                      <span className="DocsEndpointPath">/v2/appointments</span>
                      <span className="DocsEndpointScope">Scope: appointments:write</span>
                    </div>
                    <p className="DocsArticleText">
                      <strong>Required fields</strong> —{' '}
                      <code className="DocsInlineCode">patient</code> (FHIR reference),{' '}
                      <code className="DocsInlineCode">serviceType</code>, and{' '}
                      <code className="DocsInlineCode">start</code>. Omit{' '}
                      <code className="DocsInlineCode">practitioner</code> to let the clinic assign
                      one.
                    </p>
                    <div className="DocsNote">
                      <IoBulbOutline
                        size={15}
                        className="shrink-0 mt-0.5 text-cyan-text"
                        aria-hidden="true"
                      />
                      <span className="DocsNoteText">
                        Appointments are FHIR R4 <code className="DocsInlineCode">Appointment</code>{' '}
                        resources. Anything you write here reads back identically from the FHIR
                        endpoint.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="DocsNote">
                    <IoBulbOutline
                      size={15}
                      className="text-cyan-text"
                      style={{ flex: 'none', marginTop: 2 }}
                      aria-hidden="true"
                    />
                    <span className="DocsNoteText">
                      This reference is seed content. Open the full documentation for the complete
                      API reference.
                    </span>
                  </div>
                )}
              </article>

              {isAppointments && (
                <div className="DocsCode">
                  <div className="DocsCodePanel">
                    <div className="DocsCodePanelHead">
                      <span className="DocsCodePanelLabel">REQUEST · cURL</span>
                      <button
                        type="button"
                        className="DocsCodeCopy"
                        onClick={() => handleCopy('request', CURL_SAMPLE)}
                      >
                        <IoCopyOutline size={11} aria-hidden="true" />
                        {copiedKey === 'request' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="DocsCodePre">{CURL_SAMPLE}</pre>
                  </div>
                  <div className="DocsCodePanel">
                    <div className="DocsCodePanelHead">
                      <span className="DocsCodePanelLabel">RESPONSE · 201</span>
                      <button
                        type="button"
                        className="DocsCodeCopy"
                        onClick={() => handleCopy('response', RESPONSE_SAMPLE)}
                      >
                        <IoCopyOutline size={11} aria-hidden="true" />
                        {copiedKey === 'response' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="DocsCodePre">{RESPONSE_SAMPLE}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </DevRouteGuard>
  );
};

export default DeveloperDocs;
