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

  const handleSubmit = (event: React.FormEvent) => {
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
        The scopes are stored on the key and returned when it is listed, but
        nothing checks them yet: `requireScope` exists in
        apps/backend/src/middlewares/api-key-auth.ts and is mounted on no route.
        Saying so is the difference between a field a developer can plan around
        and one that looks like an access control it is not. The old placeholder
        also suggested `inventory:read`, a scope no endpoint has ever read.
      */}
      <p id="apiKeyScopesHelp" className="text-caption-2 text-text-tertiary">
        Recorded on the key for forward compatibility. No endpoint enforces scopes yet, so a key is
        not restricted by what you enter here.
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
