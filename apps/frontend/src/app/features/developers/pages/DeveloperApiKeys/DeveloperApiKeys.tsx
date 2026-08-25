'use client';
import React, { useCallback, useEffect, useState } from 'react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { logger } from '@/app/lib/logger';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyEnvironment,
  type DeveloperApiKey,
  type IssuedApiKey,
} from '@/app/services/developerApiKeys';

import './DeveloperApiKeys.css';
import '@/app/features/organizations/styles/Organizations.css';

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString() : '—';

const DeveloperApiKeys = () => {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>('live');
  const [scopesInput, setScopesInput] = useState('');
  const [creating, setCreating] = useState(false);

  const [issued, setIssued] = useState<IssuedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await listApiKeys());
    } catch (err) {
      logger.error('Failed to load API keys', err);
      setError('Could not load your API keys. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const resetForm = () => {
    setName('');
    setScopesInput('');
    setEnvironment('live');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const scopes = scopesInput
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean);
      const result = await createApiKey({
        name: name.trim(),
        environment,
        scopes: scopes.length ? scopes : undefined,
      });
      setIssued(result);
      setCopied(false);
      setShowForm(false);
      resetForm();
      await loadKeys();
    } catch (err) {
      logger.error('Failed to create API key', err);
      setError('Could not create the API key. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      await revokeApiKey(id);
      await loadKeys();
    } catch (err) {
      logger.error('Failed to revoke API key', err);
      setError('Could not revoke the API key. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.apiKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const renderKeyList = () => {
    if (loading) {
      return <p className="text-body-3 text-text-secondary">Loading API keys…</p>;
    }
    if (keys.length === 0) {
      return (
        <p className="text-body-3 text-text-secondary" data-testid="api-keys-empty">
          You don&apos;t have any API keys yet.
        </p>
      );
    }
    return (
      <table className="DevApiKeys-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Env</th>
            <th>Status</th>
            <th>Last used</th>
            <th>Created</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {keys.map((apiKey) => (
            <tr key={apiKey.id}>
              <td>{apiKey.name}</td>
              <td>
                <code>
                  {apiKey.prefix}…{apiKey.last4}
                </code>
              </td>
              <td>{apiKey.environment}</td>
              <td>{apiKey.status}</td>
              <td>{formatDate(apiKey.lastUsedAt)}</td>
              <td>{formatDate(apiKey.createdAt)}</td>
              <td>
                {apiKey.status === 'active' && (
                  <Secondary
                    danger
                    text="Revoke"
                    onClick={() => handleRevoke(apiKey.id)}
                    style={{ maxWidth: 110 }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h1 className="text-heading-1 text-text-primary">API Keys</h1>
          {!showForm && (
            <Primary
              text="Create API key"
              onClick={() => setShowForm(true)}
              style={{ maxWidth: 200 }}
            />
          )}
        </div>

        <p className="text-body-3 text-text-secondary DevApiKeys-intro">
          Use API keys to authenticate apps and agents against the Yosemite Crew API. Treat them
          like passwords — never expose them in client-side code.
        </p>

        {issued && (
          <div className="DevApiKeys-reveal" role="alert">
            <p className="text-body-2 text-text-primary">
              Copy your new key now. For your security it won&apos;t be shown again.
            </p>
            <div className="DevApiKeys-secret">
              <code data-testid="issued-secret">{issued.apiKey}</code>
              <Secondary
                text={copied ? 'Copied' : 'Copy'}
                onClick={handleCopy}
                style={{ maxWidth: 120 }}
              />
            </div>
            <Secondary text="Done" onClick={() => setIssued(null)} style={{ maxWidth: 120 }} />
          </div>
        )}

        {showForm && (
          <form className="DevApiKeys-form" onSubmit={handleCreate}>
            <label className="text-body-3 text-text-primary" htmlFor="apiKeyName">
              Key name
            </label>
            <input
              id="apiKeyName"
              className="DevApiKeys-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Production server"
              maxLength={100}
            />
            <label className="text-body-3 text-text-primary" htmlFor="apiKeyEnv">
              Environment
            </label>
            <select
              id="apiKeyEnv"
              className="DevApiKeys-input"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as ApiKeyEnvironment)}
            >
              <option value="live">Live</option>
              <option value="test">Test</option>
            </select>
            <label className="text-body-3 text-text-primary" htmlFor="apiKeyScopes">
              Scopes (optional, comma-separated)
            </label>
            <input
              id="apiKeyScopes"
              className="DevApiKeys-input"
              value={scopesInput}
              onChange={(event) => setScopesInput(event.target.value)}
              placeholder="appointments:read, inventory:read"
            />
            <div className="DevApiKeys-formActions">
              <Primary
                text={creating ? 'Creating…' : 'Create'}
                type="submit"
                isDisabled={!name.trim() || creating}
                style={{ maxWidth: 140 }}
              />
              <Secondary
                text="Cancel"
                onClick={() => setShowForm(false)}
                style={{ maxWidth: 120 }}
              />
            </div>
          </form>
        )}

        {error && (
          <p className="text-body-3 DevApiKeys-error" role="alert">
            {error}
          </p>
        )}

        {renderKeyList()}
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperApiKeys;
