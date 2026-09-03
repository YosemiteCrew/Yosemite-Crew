'use client';
import React, { useState } from 'react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type { ApiKeyEnvironment } from '@/app/services/developerApiKeys';

export interface NewApiKeyInput {
  name: string;
  environment: ApiKeyEnvironment;
  scopes?: string[];
}

/**
 * Owns its own field state.
 *
 * The page unmounts this on a successful create, which discards the fields - so
 * there is no reset to remember. A failed create leaves it mounted, which is
 * what keeps the typed values around for a retry.
 */
const CreateKeyForm = ({
  creating,
  onCreate,
  onCancel,
}: {
  creating: boolean;
  onCreate: (input: NewApiKeyInput) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>('live');
  const [scopesInput, setScopesInput] = useState('');

  const handleSubmit = (event: React.SubmitEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;

    /* flatMap rather than split+filter: it drops the empty strings a trailing
       comma or a stray space produces, in one pass. */
    const scopes = scopesInput.split(',').flatMap((scope) => {
      const trimmed = scope.trim();
      return trimmed ? [trimmed] : [];
    });

    onCreate({
      name: name.trim(),
      environment,
      scopes: scopes.length ? scopes : undefined,
    });
  };

  return (
    <form className="DevApiKeys-form" onSubmit={handleSubmit}>
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
        placeholder="appointments:read"
        aria-describedby="apiKeyScopesHelp"
      />
      {/*
        This copy has to track what `requireScope` is actually mounted on, or it
        becomes the thing it was written to prevent - a field that looks like an
        access control and is not. It is now mounted: the `/v1/developer`
        appointment routes require `appointments:read`. Everything else a
        developer types is still recorded and gates nothing, so the sentence
        names the one scope that works rather than implying a taxonomy.

        A key created before this shipped carries no scopes and will be refused
        by those routes, which is the correct outcome: nothing could have been
        calling them, because they did not exist.
      */}
      <p id="apiKeyScopesHelp" className="text-caption-2 text-text-tertiary">
        Enforced where an endpoint exists to enforce them: a key needs{' '}
        <code>appointments:read</code> to call the appointment endpoints under{' '}
        <code>/v1/developer</code>. Any other scope you enter is recorded on the key but does not
        gate anything yet.
      </p>
      <div className="DevApiKeys-formActions">
        <Primary
          text={creating ? 'Creating…' : 'Create'}
          type="submit"
          isDisabled={!name.trim() || creating}
          style={{ maxWidth: 140 }}
        />
        <Secondary text="Cancel" onClick={onCancel} style={{ maxWidth: 120 }} />
      </div>
    </form>
  );
};

export default CreateKeyForm;
