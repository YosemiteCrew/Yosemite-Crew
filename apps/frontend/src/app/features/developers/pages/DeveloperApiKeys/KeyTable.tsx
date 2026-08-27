'use client';
import React from 'react';

import { Secondary } from '@/app/ui/primitives/Buttons';
import type { DeveloperApiKey } from '@/app/services/developerApiKeys';

/**
 * ISO date, not `toLocaleDateString`.
 *
 * This renders during SSR too, and a locale/timezone-dependent format there is
 * the server's, not the reader's, so the two passes disagree and React reports a
 * hydration mismatch (react-doctor/no-locale-format-in-render). `toISOString` is
 * UTC by definition, so both passes produce the same string.
 *
 * It also happens to be the better format for this table: key metadata is
 * developer-facing, where an unambiguous sortable date beats one whose 03/04 you
 * have to guess at.
 */
const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10);
};

/**
 * Presentational: it owns no state and performs no requests, so the loading and
 * empty cases are passed in rather than inferred. `keys.length === 0` alone
 * cannot tell "none yet" from "not loaded yet".
 */
const KeyTable = ({
  keys,
  loading,
  onRevoke,
}: {
  keys: DeveloperApiKey[];
  loading: boolean;
  onRevoke: (id: string) => void;
}) => {
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
            <td>
              <span className={`DevApiKeys-badge DevApiKeys-badge--${apiKey.environment}`}>
                {apiKey.environment}
              </span>
            </td>
            <td>
              <span className={`DevApiKeys-badge DevApiKeys-badge--${apiKey.status}`}>
                {apiKey.status}
              </span>
            </td>
            <td>{formatDate(apiKey.lastUsedAt)}</td>
            <td>{formatDate(apiKey.createdAt)}</td>
            <td>
              {apiKey.status === 'active' && (
                <Secondary
                  danger
                  text="Revoke"
                  onClick={() => onRevoke(apiKey.id)}
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

export default KeyTable;
