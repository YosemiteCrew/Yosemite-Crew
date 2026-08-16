'use client';

import React, { useMemo, useState } from 'react';
import { IoCheckmarkCircle, IoKeyOutline } from 'react-icons/io5';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { useAuthStore } from '@/app/stores/authStore';
import { useNotify } from '@/app/hooks/useNotify';

import './DeveloperSettings.css';

const WEBHOOK_ENDPOINT = 'https://api.timmdevices.de/yc/hooks';

/** Read an ID-token claim as a string; non-string claims collapse to ''. */
const claimString = (value: unknown): string => (typeof value === 'string' ? value : '');

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)![0]}`.toUpperCase();
};

type SwitchProps = { label: string; checked: boolean; onChange: () => void };

const SettingsSwitch = ({ label, checked, onChange }: SwitchProps) => (
  <div className="dev-toggle-row">
    <span className="dev-toggle-label">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`dev-switch${checked ? ' on' : ''}`}
      onClick={onChange}
    >
      <span className="dev-switch-thumb" />
    </button>
  </div>
);

const DeveloperSettings = () => {
  const { notify } = useNotify();
  const { attributes, user } = useAuthStore();
  // SuperTokens replaced the Cognito ID token with a flat attributes record, so
  // the claims are read straight off the store rather than decoded from a JWT.
  const payload: Record<string, unknown> = attributes ?? {};

  const displayName = useMemo(() => {
    const name = `${claimString(payload?.given_name)} ${claimString(payload?.family_name)}`.trim();
    if (name) return name;
    const claimEmail = claimString(payload?.email);
    if (claimEmail) return claimEmail;
    return user?.getUsername?.() || 'Developer';
  }, [payload?.email, payload?.family_name, payload?.given_name, user]);

  const email = (payload?.email as string) || '—';
  const company = (payload?.['custom:company'] as string) || 'Not set';
  const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';

  const [emailFailures, setEmailFailures] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [changelog, setChangelog] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const handleRevoke = () => {
    setConfirmRevoke(false);
    notify('warning', {
      title: 'Key management API coming soon',
      text: 'Revoking keys is not available yet. No keys were changed.',
    });
  };

  const handleRotate = () => {
    setConfirmRotate(false);
    notify('warning', {
      title: 'Secret rotation coming soon',
      text: 'Rotating the signing secret is not available yet.',
    });
  };

  const handleSave = () => {
    notify('success', {
      title: 'Notification preferences saved',
      text: 'Your webhook notification settings were updated.',
    });
  };

  return (
    <DevRouteGuard>
      <div className="DevSettings">
        <div className="dev-settings-shell">
          <div className="dev-settings-head">
            <div className="dev-settings-heading">
              <span className="dev-settings-kicker">Developer</span>
              <h1 className="dev-settings-title">Settings</h1>
            </div>
            <div className="dev-settings-user">
              <span className="dev-settings-avatar">{getInitials(displayName)}</span>
              <span className="dev-settings-username">{displayName}</span>
            </div>
          </div>

          <p className="dev-settings-preview text-caption-2">
            Preview · webhook health and key actions are illustrative. Your profile is your live
            developer account.
          </p>

          <div className="dev-settings-grid">
            <div className="dev-settings-col">
              <span className="dev-settings-label">Profile</span>
              <div className="dev-settings-field">
                <span className="dev-settings-field-label">Developer name</span>
                <span className="dev-settings-field-value">{displayName}</span>
              </div>
              <div className="dev-settings-field">
                <span className="dev-settings-field-label">Company</span>
                <span className="dev-settings-field-value">{company}</span>
              </div>
              <div className="dev-settings-field">
                <span className="dev-settings-field-label">Contact email</span>
                <span className="dev-settings-field-value">{email}</span>
                {emailVerified ? (
                  <span className="dev-settings-verified">
                    <IoCheckmarkCircle size={13} aria-hidden="true" />
                    Verified
                  </span>
                ) : (
                  <span className="dev-settings-unverified">Unverified</span>
                )}
              </div>

              <span className="dev-settings-label spaced">Danger zone</span>
              <div className="dev-danger">
                <span className="dev-danger-copy">
                  <span className="dev-danger-title">Revoke all API keys</span>
                  <span className="dev-danger-text">
                    Every integration stops immediately. Cannot be undone.
                  </span>
                </span>
                <span className="dev-danger-actions">
                  {confirmRevoke ? (
                    <>
                      <button
                        type="button"
                        className="dev-confirm-btn confirm"
                        onClick={handleRevoke}
                      >
                        Confirm revoke
                      </button>
                      <button
                        type="button"
                        className="dev-confirm-btn cancel"
                        onClick={() => setConfirmRevoke(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="dev-danger-btn"
                      onClick={() => setConfirmRevoke(true)}
                    >
                      Revoke all
                    </button>
                  )}
                </span>
              </div>
            </div>

            <div className="dev-settings-col">
              <span className="dev-settings-label">Webhooks &amp; notifications</span>
              <div className="dev-settings-field">
                <span className="dev-settings-field-label">Webhook endpoint</span>
                <span className="dev-settings-field-value mono">{WEBHOOK_ENDPOINT}</span>
                <span className="dev-health">
                  <span className="dev-health-dot" />
                  {'200 OK'}
                </span>
              </div>

              <SettingsSwitch
                label="Email me on failed deliveries"
                checked={emailFailures}
                onChange={() => setEmailFailures((v) => !v)}
              />
              <SettingsSwitch
                label="Weekly usage digest"
                checked={weeklyDigest}
                onChange={() => setWeeklyDigest((v) => !v)}
              />
              <SettingsSwitch
                label="Platform changelog emails"
                checked={changelog}
                onChange={() => setChangelog((v) => !v)}
              />

              <div className="dev-secret-card">
                <span className="dev-secret-icon">
                  <IoKeyOutline size={15} aria-hidden="true" />
                </span>
                <span className="dev-secret-text">
                  Signing secret rotated 14 days ago.{' '}
                  {confirmRotate ? (
                    <>
                      <button type="button" className="dev-secret-action" onClick={handleRotate}>
                        Confirm rotate
                      </button>
                      <button
                        type="button"
                        className="dev-secret-cancel"
                        onClick={() => setConfirmRotate(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="dev-secret-action"
                      onClick={() => setConfirmRotate(true)}
                    >
                      Rotate now
                    </button>
                  )}
                </span>
              </div>

              <button type="button" className="dev-settings-save" onClick={handleSave}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperSettings;
