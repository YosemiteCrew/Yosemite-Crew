'use client';
import React, { useCallback, useEffect, useState } from 'react';

import { Primary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { logger } from '@/app/lib/logger';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type DeveloperApiKey,
  type IssuedApiKey,
} from '@/app/services/developerApiKeys';

import CreateKeyForm, { type NewApiKeyInput } from './CreateKeyForm';
import KeyReveal from './KeyReveal';
import KeyTable from './KeyTable';

import './DeveloperApiKeys.css';
import '@/app/features/organizations/styles/Organizations.css';

/**
 * Owns the data and the three requests; the form, the reveal and the table are
 * separate components that hold their own presentation state. What is left here
 * is the server-backed state the page coordinates - the key list, whether a
 * create is in flight, the one issued key, and the last error.
 */
const DeveloperApiKeys = () => {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedApiKey | null>(null);

  const loadKeys = useCallback(async () => {
    // No setLoading(true) here: this runs from the mount effect and `loading`
    // already starts true, so setting it again would be a synchronous state
    // write during the effect body.
    try {
      const next = await listApiKeys();
      setKeys(next);
      setError(null);
    } catch (err) {
      logger.error('Failed to load API keys', err);
      setError('Could not load your API keys. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wrapped rather than called directly: the hooks lint cannot see through the
    // useCallback to prove the setStates all happen after an await, and flags a
    // bare `loadKeys()` as a synchronous state write.
    const run = async () => {
      await loadKeys();
    };
    run();
  }, [loadKeys]);

  const handleCreate = async (input: NewApiKeyInput) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createApiKey(input);
      setIssued(result);
      // Closing the form unmounts it, which is what clears the typed fields.
      // On failure it stays open and keeps them for a retry.
      setShowForm(false);
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

        {issued && <KeyReveal issued={issued} onDone={() => setIssued(null)} />}

        {showForm && (
          <CreateKeyForm
            creating={creating}
            onCreate={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {error && (
          <p className="text-body-3 DevApiKeys-error" role="alert">
            {error}
          </p>
        )}

        <KeyTable keys={keys} loading={loading} onRevoke={handleRevoke} />
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperApiKeys;
