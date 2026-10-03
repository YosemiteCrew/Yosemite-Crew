'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { IoArrowBack, IoCopyOutline, IoLogoNodejs } from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperMCPPlayground.css';

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

type ExportTab = 'claude' | 'vscode' | 'cursor' | 'docker' | 'npx';

const EXPORT_TABS: { id: ExportTab; label: string; icon?: React.ReactNode }[] = [
  { id: 'claude', label: 'Claude Desktop', icon: <span className="tab-icon">🤖</span> },
  { id: 'vscode', label: 'VS Code', icon: <span className="tab-icon">📝</span> },
  { id: 'cursor', label: 'Cursor', icon: <span className="tab-icon">✨</span> },
  { id: 'docker', label: 'Docker', icon: <IoLogoNodejs size={14} /> },
  { id: 'npx', label: 'npx', icon: <IoLogoNodejs size={14} /> },
];

const MCP_PACKAGE = '@yosemitecrew/mcp-server';

// Nothing generated on this page carries the key the user typed: the copied
// configuration points at the environment variable instead, so pasting it never
// writes a live key into a file on disk or a chat window.
const API_KEY_PLACEHOLDER = 'YOUR_API_KEY';

const API_BASE_ENV_VAR = 'YC_API_BASE_URL';
const API_KEY_ENV_VAR = 'YC_API_KEY';

// The server needs to be told which host to call. Left out, it falls back to a
// machine on the reader's own computer and the first request never arrives, so
// every configuration here carries the portal's address — the same one the
// playground sends.
const apiBase = (): string => {
  let base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  while (base.endsWith('/')) base = base.slice(0, -1);
  return base;
};

const serverEnv = (): Record<string, string> => {
  const base = apiBase();
  return base
    ? { [API_KEY_ENV_VAR]: API_KEY_PLACEHOLDER, [API_BASE_ENV_VAR]: base }
    : { [API_KEY_ENV_VAR]: API_KEY_PLACEHOLDER };
};

const claudeConfig = () => ({
  mcpServers: {
    'yosemite-crew': {
      command: 'npx',
      args: ['-y', MCP_PACKAGE],
      env: serverEnv(),
    },
  },
});

const vscodeConfig = () => ({
  mcp: {
    servers: {
      'yosemite-crew': {
        command: 'npx',
        args: ['-y', MCP_PACKAGE],
        env: serverEnv(),
      },
    },
  },
});

// Docker already forwards the variables from the host environment, so this one
// needs no placeholder: an env block here would override the forwarded values.
const dockerConfig = () => ({
  mcpServers: {
    'yosemite-crew': {
      command: 'docker',
      args: [
        'run',
        '-i',
        '--rm',
        '-e',
        API_KEY_ENV_VAR,
        ...(apiBase() ? ['-e', API_BASE_ENV_VAR] : []),
        'ghcr.io/yosemitecrew/mcp-server:latest',
      ],
    },
  },
});

const npxCommand = () => {
  const base = apiBase();
  return [
    `${API_KEY_ENV_VAR}=${API_KEY_PLACEHOLDER}`,
    ...(base ? [`${API_BASE_ENV_VAR}=${base}`] : []),
    `npx -y ${MCP_PACKAGE}`,
  ].join(' ');
};

const getConfigForTab = (tab: ExportTab) => {
  switch (tab) {
    case 'claude':
      return JSON.stringify(claudeConfig(), null, 2);
    case 'vscode':
      return JSON.stringify(vscodeConfig(), null, 2);
    case 'cursor':
      return JSON.stringify(claudeConfig(), null, 2);
    case 'docker':
      return JSON.stringify(dockerConfig(), null, 2);
    case 'npx':
      return npxCommand();
    default:
      return '';
  }
};

const getConfigLabel = (tab: ExportTab) => {
  switch (tab) {
    case 'claude':
      return 'Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json on macOS)';
    case 'vscode':
      return 'VS Code settings (settings.json)';
    case 'cursor':
      return 'Cursor settings (settings.json)';
    case 'docker':
      return 'Docker-based config (for isolated environments)';
    case 'npx':
      return 'Direct npx command (for testing)';
    default:
      return '';
  }
};

type MCPTool = {
  readonly name: string;
  readonly description: string;
  readonly scope: string;
  readonly params?: readonly string[];
};

const TOOLS: readonly MCPTool[] = [
  {
    name: 'list_organizations',
    description:
      'List the veterinary practices this API key may read, with the role the key owner holds at each. Call this before any other tool: the organisation id it returns is the required input for them, and only practices with a currently active membership appear.',
    scope: 'None',
  },
  {
    name: 'get_usage',
    description:
      "Report this API key owner's call count and monthly quota for the current billing period. Needs no organisation and consumes no scope. Test-environment keys are never metered, so they report a count of zero.",
    scope: 'None',
  },
  {
    name: 'list_appointments',
    description:
      'List appointments for one practice, oldest first, with optional date-window and status filters. Results are paginated: when the response carries pagination.nextCursor there are more, and that value is the cursor for the next call.',
    scope: 'appointments:read',
    params: [
      'organisationId (required)',
      'from (ISO 8601)',
      'to (ISO 8601)',
      'status (enum)',
      'limit (1-100)',
      'cursor',
    ],
  },
  {
    name: 'get_appointment',
    description:
      'Fetch one appointment by id, including the patient snapshot, lead clinician, room, timing and status. Returns not-found if the appointment belongs to a practice this key cannot read.',
    scope: 'appointments:read',
    params: ['organisationId (required)', 'appointmentId (required)'],
  },
];

const MCPIntro = ({ apiKey }: { apiKey: string | null }) => (
  <div className="MCPIntro">
    <h1 className="MCPTitle">MCP playground</h1>
    <p className="MCPText">
      The Yosemite Crew MCP server exposes the same read-only developer API as tools your AI
      assistant can call. Configure your client with an API key from the{' '}
      <Link href="/developers/api-keys">API keys page</Link> and start asking questions like:
    </p>
    <ul className="MCPExamples">
      <li>
        <code>&ldquo;What practices can my key access?&rdquo;</code>
      </li>
      <li>
        <code>&ldquo;Show me appointments for practice org_abc from last week&rdquo;</code>
      </li>
      <li>
        <code>&ldquo;What&apos;s my API usage this month?&rdquo;</code>
      </li>
    </ul>
    <p className="MCPText">
      The server runs locally via stdio — your API key never leaves your machine. Choose a client
      below to get a ready-to-paste configuration.
    </p>
    {apiKey ? (
      <p className="MCPText MCPText--hint">
        Using the API key currently in the field above. It stays on this page: nothing you copy
        below contains it. <Link href="/developers/api-keys">Manage keys</Link>
      </p>
    ) : (
      <p className="MCPText MCPText--hint">
        Paste an API key above to see the client configurations.{' '}
        <Link href="/developers/api-keys">Create a key</Link>
      </p>
    )}
  </div>
);

type KeyFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

const KeyField = ({ id, value, onChange }: KeyFieldProps) => (
  <div className="MCPField">
    <label className="MCPLabel" htmlFor={id}>
      API key
    </label>
    <input
      id={id}
      className="MCPInput"
      type="password"
      autoComplete="off"
      spellCheck={false}
      value={value}
      placeholder="yc_dev_..."
      onChange={(e) => onChange(e.target.value)}
    />
    <span className="MCPHint">
      Held in this page only. It is not saved, and it is not included in anything you copy — the
      configuration below points at your environment instead.{' '}
      <Link href="/developers/api-keys">Manage keys</Link>
    </span>
  </div>
);

const ToolCard = ({ tool }: { tool: (typeof TOOLS)[number] }) => (
  <div className="MCPToolCard">
    <div className="MCPToolHead">
      <code className="MCPToolName">{tool.name}</code>
      {tool.scope !== 'None' && <span className="MCPScopeBadge">{tool.scope}</span>}
    </div>
    <p className="MCPToolDesc">{tool.description}</p>
    {tool.params && (
      <div className="MCPToolParams">
        <span className="MCPToolParamsLabel">Parameters:</span>
        <ul>
          {tool.params.map((param) => (
            <li key={param}>
              <code>{param}</code>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const MCPConfigExport = () => {
  const [exportTab, setExportTab] = useState<ExportTab>('claude');
  const [copied, setCopied] = useState(false);
  const configText = getConfigForTab(exportTab);
  const configLabel = getConfigLabel(exportTab);

  const handleCopy = async () => {
    const ok = await copyText(configText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="MCPExport" aria-label="MCP client configuration">
      <h2 className="MCPExportTitle">Client configuration</h2>
      <p className="MCPExportSubtitle">{configLabel}</p>
      <div className="MCPExportTabs" role="tablist" aria-label="Configuration target">
        {EXPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={exportTab === tab.id}
            className={`MCPExportTab${exportTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setExportTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        <button type="button" className="MCPExportCopy" onClick={handleCopy} disabled={!configText}>
          <IoCopyOutline size={12} aria-hidden="true" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="MCPExportPre" role="tabpanel" tabIndex={0}>
        {configText}
      </pre>
      {configText.includes(API_KEY_PLACEHOLDER) && (
        <p className="MCPExportNote">
          Replace {API_KEY_PLACEHOLDER} with the key from the API keys page before you paste this.
          The key is not in the text above.
        </p>
      )}
    </section>
  );
};

const DeveloperMCPPlayground = () => {
  const idPrefix = useId();
  const [apiKey, setApiKey] = useState('');

  return (
    <DevRouteGuard>
      <section className="MCPWrapper">
        <div className="MCPHeader">
          <Link href="/developers/documentation" className="MCPBackLink">
            <IoArrowBack size={18} />
            <span>Back to documentation</span>
          </Link>
        </div>

        <div className="MCPShell">
          <MCPIntro apiKey={apiKey || null} />
          <KeyField id={`${idPrefix}-key`} value={apiKey} onChange={setApiKey} />
          {apiKey && <MCPConfigExport />}
          <section className="MCPTools" aria-label="Available MCP tools">
            <h2 className="MCPToolsTitle">Available tools</h2>
            <div className="MCPToolsGrid">
              {TOOLS.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </section>
          <section className="MCPNotes">
            <h2 className="MCPNotesTitle">Notes</h2>
            <ul>
              <li>
                The MCP server is open source:{' '}
                <a
                  href="https://github.com/YosemiteCrew/Yosemite-Crew/tree/dev/packages/mcp-server"
                  target="_blank"
                  rel="noreferrer"
                >
                  packages/mcp-server
                </a>
              </li>
              <li>
                It uses the same <code>/v1/developer</code> API as the playground — read-only,
                scoped by your key
              </li>
              <li>
                Run <code>npx -y @yosemitecrew/mcp-server</code> locally; the key comes from{' '}
                <code>YC_API_KEY</code> in your environment
              </li>
              <li>
                For production use, pin a version instead of <code>-y</code> (e.g.,{' '}
                <code>npx @yosemitecrew/mcp-server@1.2.3</code>)
              </li>
              <li>
                Docker image: <code>ghcr.io/yosemitecrew/mcp-server:latest</code>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </DevRouteGuard>
  );
};

export default DeveloperMCPPlayground;
