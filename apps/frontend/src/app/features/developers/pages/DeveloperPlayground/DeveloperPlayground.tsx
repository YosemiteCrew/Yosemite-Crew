'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { IoArrowBack, IoCopyOutline } from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { Button } from '@/app/ui';
import {
  API_KEY_ENV_VAR,
  CORRELATION_HEADERS,
  PLAYGROUND_OPERATIONS,
  buildRequest,
  describeFailure,
  formatBody,
  readNextCursor,
  readPractices,
  resolveUrl,
  toCurl,
  toRequestFixture,
  toTypeScript,
  validateParams,
  type BuiltRequest,
  type FormattedBody,
  type OperationParam,
  type ParamValues,
  type PracticeOption,
} from './playgroundOperations';

import './DeveloperPlayground.css';

type RunResult =
  | { kind: 'cancelled' }
  | { kind: 'unconfigured' }
  | {
      kind: 'response';
      operationId: string;
      status: number;
      elapsedMs: number;
      body: FormattedBody | null;
      failure: string | null;
      correlationId: string | null;
      nextCursor: string | null;
    };

type ExportTab = 'curl' | 'typescript' | 'fixture';

const EXPORT_TABS: { id: ExportTab; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'fixture', label: 'Request fixture' },
];

const readServerMessage = (json: unknown): string | null => {
  const message = (json as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : null;
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const correlationIdOf = (headers: Headers): string | null => {
  for (const name of CORRELATION_HEADERS) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
};

/** Sends one request and describes the outcome. Never throws. */
const sendRequest = async (
  operationId: string,
  request: BuiltRequest,
  url: string,
  key: string,
  controller: AbortController
): Promise<{ result: RunResult; json: unknown }> => {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: { ...request.headers, Authorization: `Bearer ${key}` },
      // Key only: the developer's session cookie must never reach the data plane.
      credentials: 'omit',
      // A redirect would carry the key to wherever it points.
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const raw = await response.text();
    const json = parseJson(raw);
    return {
      json,
      result: {
        kind: 'response',
        operationId,
        status: response.status,
        elapsedMs: elapsed(),
        body: raw ? formatBody(raw) : null,
        failure: describeFailure(response.status, readServerMessage(json)),
        correlationId: correlationIdOf(response.headers),
        nextCursor: readNextCursor(json),
      },
    };
  } catch {
    if (controller.signal.aborted) return { json: null, result: { kind: 'cancelled' } };
    return {
      json: null,
      result: {
        kind: 'response',
        operationId,
        status: 0,
        elapsedMs: elapsed(),
        body: null,
        failure: describeFailure(0, null),
        correlationId: null,
        nextCursor: null,
      },
    };
  }
};

type Props = {
  /** The API origin. Defaults to the build's NEXT_PUBLIC_BASE_URL. */
  baseUrl?: string;
};

type DraftsSetter = React.Dispatch<React.SetStateAction<Record<string, ParamValues>>>;

type RequestRunnerArgs = {
  baseUrl: string | undefined;
  operation: (typeof PLAYGROUND_OPERATIONS)[number];
  values: ParamValues;
  apiKey: string;
  setDrafts: DraftsSetter;
};

const useRequestRunner = ({ baseUrl, operation, values, apiKey, setDrafts }: RequestRunnerArgs) => {
  const [keyError, setKeyError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [practices, setPractices] = useState<PracticeOption[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const setValue = (name: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [operation.id]: { ...prev[operation.id], [name]: value } }));
    setErrors((prev) => {
      const { [name]: _cleared, ...rest } = prev;
      return rest;
    });
  };

  const run = async (override?: ParamValues) => {
    const input = override ?? values;
    const fieldErrors = validateParams(operation, input);
    setErrors(fieldErrors);
    const key = apiKey.trim();
    setKeyError(key ? null : 'Paste an API key from the API keys page.');
    if (!key || Object.keys(fieldErrors).length > 0) return;

    const built = buildRequest(operation, input);
    const target = resolveUrl(baseUrl, built.path);
    if (!target) {
      setResult({ kind: 'unconfigured' });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const { result: outcome, json } = await sendRequest(
      operation.id,
      built,
      target,
      key,
      controller
    );
    if (abortRef.current === controller) abortRef.current = null;
    setResult(outcome);
    setRunning(false);
    if (outcome.kind === 'response' && !outcome.failure && operation.id === 'listOrganizations') {
      setPractices(readPractices(json));
    }
  };

  const runNextPage = async (cursor: string) => {
    const next = { ...values, cursor };
    setDrafts((prev) => ({ ...prev, [operation.id]: next }));
    await run(next);
  };

  return {
    abortRef,
    errors,
    keyError,
    practices,
    result,
    running,
    run,
    runNextPage,
    setErrors,
    setKeyError,
    setResult,
    setValue,
  };
};

const useExport = (
  operation: (typeof PLAYGROUND_OPERATIONS)[number],
  request: BuiltRequest,
  url: string | null
) => {
  const [exportTab, setExportTab] = useState<ExportTab>('curl');
  const [copied, setCopied] = useState(false);
  const exportText = useMemo(() => {
    if (!url) return '';
    if (exportTab === 'typescript') return toTypeScript(request, url);
    if (exportTab === 'fixture') return toRequestFixture(operation, request, url);
    return toCurl(request, url);
  }, [exportTab, operation, request, url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return { copied, exportTab, exportText, handleCopy, setExportTab };
};

const PlaygroundIntro = ({ apiHost }: { apiHost: string | null }) => (
  <div className="PlaygroundIntro">
    <h1 className="PlaygroundTitle">API playground</h1>
    <p className="PlaygroundText">
      Run a read operation of the developer API with one of your keys and see the real response.
      Calls are made from this browser straight to <strong>{apiHost ?? 'the API'}</strong> and count
      toward the key&apos;s quota. They read live data from the practices your account belongs to;
      nothing is written.
    </p>
  </div>
);

type OperationFieldProps = {
  id: string;
  operationId: string;
  onChange: (operationId: string) => void;
};

const OperationField = ({ id, operationId, onChange }: OperationFieldProps) => (
  <div className="PlaygroundField">
    <label className="PlaygroundLabel" htmlFor={id}>
      Operation
    </label>
    <select
      id={id}
      className="PlaygroundInput"
      value={operationId}
      onChange={(event) => onChange(event.target.value)}
    >
      {PLAYGROUND_OPERATIONS.map((operation) => (
        <option key={operation.id} value={operation.id}>
          {operation.summary} - {operation.method} {operation.path}
        </option>
      ))}
    </select>
  </div>
);

const OperationFacts = ({ operation }: { operation: (typeof PLAYGROUND_OPERATIONS)[number] }) => (
  <dl className="PlaygroundFacts">
    <div>
      <dt>Request</dt>
      <dd>
        <code>
          {operation.method} {operation.path}
        </code>
      </dd>
    </div>
    <div>
      <dt>Key scope</dt>
      <dd>{operation.scope ?? 'None required'}</dd>
    </div>
    <div>
      <dt>Practice permission</dt>
      <dd>{operation.permission ?? 'None required'}</dd>
    </div>
  </dl>
);

type ParameterFieldsProps = {
  idPrefix: string;
  operation: (typeof PLAYGROUND_OPERATIONS)[number];
  values: ParamValues;
  errors: Record<string, string>;
  practices: PracticeOption[];
  onChange: (name: string, value: string) => void;
};

const ParameterFields = ({
  idPrefix,
  operation,
  values,
  errors,
  practices,
  onChange,
}: ParameterFieldsProps) => {
  const practicesListId = practices.length ? `${idPrefix}-practices` : undefined;
  return (
    <>
      {operation.params.map((param) => (
        <ParamField
          key={param.name}
          id={`${idPrefix}-${param.name}`}
          param={param}
          value={values[param.name] ?? ''}
          error={errors[param.name]}
          listId={param.name === 'x-org-id' ? practicesListId : undefined}
          onChange={(value) => onChange(param.name, value)}
        />
      ))}
      {practicesListId ? (
        <datalist id={practicesListId}>
          {practices.map((practice) => (
            <option key={practice.id} value={practice.id}>
              {practice.name}
            </option>
          ))}
        </datalist>
      ) : null}
    </>
  );
};

type PlaygroundFormProps = {
  idPrefix: string;
  operation: (typeof PLAYGROUND_OPERATIONS)[number];
  values: ParamValues;
  apiKey: string;
  keyError: string | null;
  errors: Record<string, string>;
  practices: PracticeOption[];
  running: boolean;
  hasResult: boolean;
  onApiKeyChange: (value: string) => void;
  onOperationChange: (operationId: string) => void;
  onParamChange: (name: string, value: string) => void;
  onRun: () => void;
  onCancel: () => void;
  onClear: () => void;
};

const PlaygroundForm = ({
  idPrefix,
  operation,
  values,
  apiKey,
  keyError,
  errors,
  practices,
  running,
  hasResult,
  onApiKeyChange,
  onOperationChange,
  onParamChange,
  onRun,
  onCancel,
  onClear,
}: PlaygroundFormProps) => (
  <form
    className="PlaygroundForm"
    onSubmit={(event) => {
      event.preventDefault();
      onRun();
    }}
    noValidate
  >
    <KeyField id={`${idPrefix}-key`} value={apiKey} error={keyError} onChange={onApiKeyChange} />
    <OperationField
      id={`${idPrefix}-operation`}
      operationId={operation.id}
      onChange={onOperationChange}
    />
    <OperationFacts operation={operation} />
    <ParameterFields
      idPrefix={idPrefix}
      operation={operation}
      values={values}
      errors={errors}
      practices={practices}
      onChange={onParamChange}
    />
    <div className="PlaygroundActions">
      <Button type="submit" text={running ? 'Running...' : 'Run'} isDisabled={running} />
      {running ? (
        <Button variant="secondary" text="Cancel" onClick={onCancel} />
      ) : (
        <Button variant="secondary" text="Clear result" isDisabled={!hasResult} onClick={onClear} />
      )}
    </div>
  </form>
);

type PlaygroundExportProps = {
  exportTab: ExportTab;
  exportText: string;
  copied: boolean;
  onTabChange: (tab: ExportTab) => void;
  onCopy: () => void;
};

const PlaygroundExport = ({
  exportTab,
  exportText,
  copied,
  onTabChange,
  onCopy,
}: PlaygroundExportProps) => (
  <section className="PlaygroundExport" aria-label="Use this request in your project">
    <div className="PlaygroundTabs" role="tablist" aria-label="Export format">
      {EXPORT_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={exportTab === tab.id}
          className={`PlaygroundTab${exportTab === tab.id ? ' is-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <button type="button" className="PlaygroundCopy" onClick={onCopy} disabled={!exportText}>
        <IoCopyOutline size={12} aria-hidden="true" />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <pre className="PlaygroundPre" role="tabpanel" tabIndex={0}>
      {exportText || 'No API address is configured for this portal.'}
    </pre>
    <p className="PlaygroundHint">
      Set <code>{API_KEY_ENV_VAR}</code> in your environment before running it. The example is
      generated from your inputs, not from the response above.
    </p>
  </section>
);

const DeveloperPlayground = ({ baseUrl = process.env.NEXT_PUBLIC_BASE_URL }: Props) => {
  const idPrefix = useId();
  const [operationId, setOperationId] = useState(PLAYGROUND_OPERATIONS[0].id);
  // Drafts are kept per operation, so switching away and back loses nothing.
  const [drafts, setDrafts] = useState<Record<string, ParamValues>>({});
  const [apiKey, setApiKey] = useState('');
  const operation =
    PLAYGROUND_OPERATIONS.find((candidate) => candidate.id === operationId) ??
    PLAYGROUND_OPERATIONS[0];
  const values = drafts[operation.id] ?? {};
  const request = buildRequest(operation, values);
  const url = resolveUrl(baseUrl, request.path);
  const apiHost = url ? new URL(url).host : null;
  const runner = useRequestRunner({ baseUrl, operation, values, apiKey, setDrafts });
  const requestExport = useExport(operation, request, url);

  const handleOperationChange = (nextOperationId: string) => {
    setOperationId(nextOperationId);
    runner.setErrors({});
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    runner.setKeyError(null);
  };

  return (
    <DevRouteGuard>
      <section className="PlaygroundWrapper">
        <div className="PlaygroundHeader">
          <Link
            href="/developers/documentation"
            className="PlaygroundBackLink text-body-4-emphasis"
          >
            <IoArrowBack size={18} />
            <span>Back to documentation</span>
          </Link>
        </div>

        <div className="PlaygroundShell">
          <PlaygroundIntro apiHost={apiHost} />
          <PlaygroundForm
            idPrefix={idPrefix}
            operation={operation}
            values={values}
            apiKey={apiKey}
            keyError={runner.keyError}
            errors={runner.errors}
            practices={runner.practices}
            running={runner.running}
            hasResult={runner.result !== null}
            onApiKeyChange={handleApiKeyChange}
            onOperationChange={handleOperationChange}
            onParamChange={runner.setValue}
            onRun={runner.run}
            onCancel={() => runner.abortRef.current?.abort()}
            onClear={() => runner.setResult(null)}
          />

          <ResultPanel
            result={runner.result}
            running={runner.running}
            operationId={operation.id}
            onNextPage={runner.runNextPage}
          />
          <PlaygroundExport
            exportTab={requestExport.exportTab}
            exportText={requestExport.exportText}
            copied={requestExport.copied}
            onTabChange={requestExport.setExportTab}
            onCopy={requestExport.handleCopy}
          />
        </div>
      </section>
    </DevRouteGuard>
  );
};

const describedBy = (hintId: string, errorId: string, error: string | null | undefined) =>
  error ? [hintId, errorId].join(' ') : hintId;

type KeyFieldProps = {
  id: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
};

const KeyField = ({ id, value, error, onChange }: KeyFieldProps) => (
  <div className="PlaygroundField">
    <label className="PlaygroundLabel" htmlFor={id}>
      API key
    </label>
    <input
      id={id}
      className={`PlaygroundInput${error ? ' has-error' : ''}`}
      type="password"
      autoComplete="off"
      spellCheck={false}
      value={value}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(`${id}-hint`, `${id}-error`, error)}
      onChange={(e) => onChange(e.target.value)}
    />
    <span id={`${id}-hint`} className="PlaygroundHint">
      Held in this page only. It is not saved, not put in the address bar and not included in
      anything you copy; exports read <code>{API_KEY_ENV_VAR}</code> instead.{' '}
      <Link href="/developers/api-keys">Manage keys</Link>
    </span>
    {error ? (
      <span id={`${id}-error`} className="PlaygroundError" role="alert">
        {error}
      </span>
    ) : null}
  </div>
);

type ParamFieldProps = {
  id: string;
  param: OperationParam;
  value: string;
  error: string | undefined;
  listId: string | undefined;
  onChange: (value: string) => void;
};

const ParamField = ({ id, param, value, error, listId, onChange }: ParamFieldProps) => {
  const common = {
    id,
    className: `PlaygroundInput${error ? ' has-error' : ''}`,
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy(`${id}-hint`, `${id}-error`, error),
  };
  return (
    <div className="PlaygroundField">
      <label className="PlaygroundLabel" htmlFor={id}>
        {param.label}
        {param.required ? <span className="PlaygroundRequired"> (required)</span> : null}
      </label>
      {param.kind === 'enum' ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">Any</option>
          {param.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type="text"
          inputMode={param.kind === 'integer' ? 'numeric' : undefined}
          autoComplete="off"
          spellCheck={false}
          list={listId}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <span id={`${id}-hint`} className="PlaygroundHint">
        {param.description}
      </span>
      {error ? (
        <span id={`${id}-error`} className="PlaygroundError" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};

type ResultPanelProps = {
  result: RunResult | null;
  running: boolean;
  operationId: string;
  onNextPage: (cursor: string) => void;
};

const ResponseView = ({
  result,
  operationId,
  onNextPage,
}: {
  result: Extract<RunResult, { kind: 'response' }>;
  operationId: string;
  onNextPage: (cursor: string) => void;
}) => {
  const { body, nextCursor } = result;
  return (
    <>
      <dl className="PlaygroundFacts">
        <div>
          <dt>Status</dt>
          <dd data-testid="playground-status">
            {result.status === 0 ? 'No response' : result.status}
          </dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{result.elapsedMs} ms</dd>
        </div>
        <div>
          <dt>Request id</dt>
          <dd>{result.correlationId ?? 'Not returned'}</dd>
        </div>
      </dl>
      {result.failure ? (
        <p className="PlaygroundError" role="alert">
          {result.failure}
        </p>
      ) : null}
      {nextCursor && result.operationId === operationId ? (
        <Button variant="secondary" text="Load next page" onClick={() => onNextPage(nextCursor)} />
      ) : null}
      {body?.truncated ? (
        <p className="PlaygroundHint">
          Showing the first {body.text.length.toLocaleString()} of{' '}
          {body.totalChars.toLocaleString()} characters.
        </p>
      ) : null}
      {body ? (
        <pre className="PlaygroundPre" tabIndex={0} aria-label="Response body">
          {body.text}
        </pre>
      ) : null}
    </>
  );
};

const ResultPanel = ({ result, running, operationId, onNextPage }: ResultPanelProps) => {
  let content: React.ReactNode;
  if (running) {
    content = <p className="PlaygroundHint">Waiting for the API...</p>;
  } else if (result === null) {
    content = <p className="PlaygroundHint">Run an operation to see its response here.</p>;
  } else if (result.kind === 'cancelled') {
    content = <p className="PlaygroundText">Request cancelled. Your inputs are unchanged.</p>;
  } else if (result.kind === 'unconfigured') {
    content = (
      <p className="PlaygroundError">
        This portal has no API address configured, so nothing can be sent.
      </p>
    );
  } else {
    content = <ResponseView result={result} operationId={operationId} onNextPage={onNextPage} />;
  }
  return (
    <section className="PlaygroundResult" aria-label="Result" aria-live="polite">
      {content}
    </section>
  );
};

export default DeveloperPlayground;
