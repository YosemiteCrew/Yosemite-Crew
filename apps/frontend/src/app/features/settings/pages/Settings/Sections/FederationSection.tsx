'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { Primary } from '@/app/ui/primitives/Buttons';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import type {
  APActorSettings,
  APFollower,
  APFollowing,
  APReferral,
  APReferralUrgency,
  LicenseTokenStatus,
  SendReferralPayload,
} from '@/app/features/federation/types/federation';
import {
  approveFollower,
  announceEmergency,
  followRemoteActor,
  getActorSettings,
  listFollowers,
  listFollowing,
  listInboundReferrals,
  listOutboundReferrals,
  rejectFollower,
  respondToReferral,
  sendReferral,
  setDirectoryListed,
  unfollowRemoteActor,
  updateLicenseToken,
} from '@/app/features/federation/services/federationService';

const URGENCY_LABELS: Record<APReferralUrgency, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
};

const URGENCY_COLORS: Record<APReferralUrgency, string> = {
  ROUTINE: 'text-text-secondary',
  URGENT: 'text-warning-700',
  EMERGENCY: 'text-danger-600',
};

// Federation states map onto the app's shared pill tones rather than carrying
// their own colours. The original panel hardcoded Tailwind's default palette,
// which predates the warm-bone redesign: those greys are cool against a warm
// ground and, being static light values, stayed light in dark mode.
const STATE_TONES: Record<string, StatusTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  DECLINED: 'danger',
  BLOCKED: 'neutral',
  CANCELLED: 'neutral',
};

const TEXT_MUTED = 'text-body-4 text-text-secondary';
const FIELD_LABEL_CLS = `block ${TEXT_MUTED} mb-1`;
const ROW_CLS =
  'flex items-center justify-between gap-3 py-2 border-b border-b-card-border last:border-b-0';
const ROW_META_CLS = 'flex flex-col gap-0.5 min-w-0';

type ListRenderState = 'loading' | 'empty' | 'ready';

const getListRenderState = (loading: boolean, isEmpty: boolean): ListRenderState => {
  if (loading) return 'loading';
  if (isEmpty) return 'empty';
  return 'ready';
};

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-card-border rounded-2xl">
    <div className="px-6 py-3 border-b border-b-card-border">
      <div className="text-body-3 text-text-primary">{title}</div>
    </div>
    <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
  </div>
);

const StateBadge = ({ state }: { state: string }) => (
  <StatusPill
    tone={STATE_TONES[state] ?? 'neutral'}
    label={state.charAt(0) + state.slice(1).toLowerCase()}
  />
);

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const { notify } = useNotify();
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      notify('success', { title: 'Copied', text: `${label} copied to clipboard.` });
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <div className={TEXT_MUTED}>{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-body-4 text-text-primary bg-card-hover px-3 py-1.5 rounded-lg overflow-x-auto">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className={`${TEXT_MUTED} hover:text-text-primary transition-colors shrink-0`}
          aria-label={`Copy ${label}`}
        >
          Copy
        </button>
      </div>
    </div>
  );
};

const ActorInfoCard = ({ actor }: { actor: APActorSettings }) => (
  <SectionCard title="Federation identity">
    <div className={TEXT_MUTED}>
      This instance&apos;s ActivityPub actor. Share your actor URI with other clinics to enable
      federation.
    </div>
    <CopyRow label="Actor URI" value={actor.uri} />
    <CopyRow label="Handle" value={`@${actor.preferredUsername}`} />
    <CopyRow label="Inbox" value={actor.inboxUri} />
  </SectionCard>
);

const LICENSE_STATUS_CONFIG: Record<
  LicenseTokenStatus,
  { label: string; tone: StatusTone; hint: string }
> = {
  none: {
    label: 'Not set',
    tone: 'neutral',
    hint: 'Paste the license token issued by Yosemite Crew below to enable federation.',
  },
  valid: {
    label: 'Verified',
    tone: 'success',
    hint: 'This instance is verified and can federate with other Yosemite Crew instances.',
  },
  invalid: {
    label: 'Invalid / expired',
    tone: 'danger',
    hint: 'The stored token is expired or invalid. Paste a fresh token from Yosemite Crew.',
  },
};

const LicenseTokenCard = ({
  status,
  onUpdated,
}: {
  status: LicenseTokenStatus;
  onUpdated: () => void;
}) => {
  const { notify } = useNotify();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const config = LICENSE_STATUS_CONFIG[status];

  const handleSubmit = async () => {
    if (!token.trim()) return;
    setSubmitting(true);
    try {
      await updateLicenseToken(token.trim());
      notify('success', { title: 'License token saved', text: 'This instance is now verified.' });
      setToken('');
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid token';
      notify('error', { title: 'Token rejected', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard title="Federation license">
      <div className="flex items-center gap-3">
        <StatusPill tone={config.tone} label={config.label} />
        <span className={TEXT_MUTED}>{config.hint}</span>
      </div>
      {status !== 'valid' && (
        <div className="flex gap-2 pt-1">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste license token..."
            className="flex-1 text-body-4 border border-card-border rounded-lg px-3 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <Primary
            href="#"
            text={submitting ? 'Saving...' : 'Save'}
            onClick={handleSubmit}
            isDisabled={submitting || !token.trim()}
          />
        </div>
      )}
    </SectionCard>
  );
};

const DirectoryListingCard = ({
  isVerified,
  directoryListed,
  onUpdated,
}: {
  isVerified: boolean;
  directoryListed: boolean;
  onUpdated: () => void;
}) => {
  const { notify } = useNotify();
  const [submitting, setSubmitting] = useState(false);

  const handleToggle = async () => {
    const next = !directoryListed;
    setSubmitting(true);
    try {
      await setDirectoryListed(next);
      notify('success', {
        title: next ? 'Listed in directory' : 'Removed from directory',
        text: next
          ? 'This clinic now appears in the federation directory.'
          : 'This clinic no longer appears in the federation directory.',
      });
      onUpdated();
    } catch {
      notify('error', {
        title: 'Update failed',
        text: 'Could not update the directory listing.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const buttonLabel = directoryListed ? 'Remove from directory' : 'List in directory';

  return (
    <SectionCard title="Directory listing">
      <div className="flex items-center gap-3">
        <StatusPill
          tone={directoryListed ? 'success' : 'neutral'}
          label={directoryListed ? 'Listed' : 'Not listed'}
        />
        <span className={TEXT_MUTED}>
          {isVerified
            ? 'List this clinic in the directory so other verified clinics can find and follow you.'
            : 'Verify this clinic with a license token before you can list it in the directory.'}
        </span>
      </div>
      <div className="flex justify-end pt-1">
        <Primary
          href="#"
          text={submitting ? 'Saving...' : buttonLabel}
          onClick={handleToggle}
          isDisabled={submitting || !isVerified}
        />
      </div>
    </SectionCard>
  );
};

const FollowersCard = () => {
  const { notify } = useNotify();
  const [followers, setFollowers] = useState<APFollower[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await listFollowers();
    if (data) setFollowers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // The loader is declared inside the effect so the hooks lint can see that
    // every setState it performs happens after an await, not synchronously
    // during the effect body.
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const handleApprove = async (uri: string) => {
    await approveFollower(uri);
    notify('success', { title: 'Follower approved', text: 'The follow request was accepted.' });
    load();
  };

  const handleReject = async (uri: string) => {
    await rejectFollower(uri);
    notify('success', { title: 'Follower rejected', text: 'The follow request was rejected.' });
    load();
  };

  const renderState = getListRenderState(loading, followers.length === 0);

  return (
    <SectionCard title="Followers">
      {renderState === 'loading' && <div className={TEXT_MUTED}>Loading...</div>}
      {renderState === 'empty' && <div className={TEXT_MUTED}>No followers yet.</div>}
      {renderState === 'ready' && (
        <div className="flex flex-col gap-3">
          {followers.map((f) => (
            <div key={f.id} className={ROW_CLS}>
              <div className={ROW_META_CLS}>
                <div className="text-body-4 text-text-primary truncate">{f.remoteActorUri}</div>
                <StateBadge state={f.state} />
              </div>
              {f.state === 'PENDING' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApprove(f.remoteActorUri)}
                    className="text-body-4 text-success-700 hover:text-success-900"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(f.remoteActorUri)}
                    className="text-body-4 text-danger-600 hover:text-danger-800"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

const FollowingCard = () => {
  const { notify } = useNotify();
  const [following, setFollowing] = useState<APFollowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorUri, setActorUri] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const data = await listFollowing();
    if (data) setFollowing(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // The loader is declared inside the effect so the hooks lint can see that
    // every setState it performs happens after an await, not synchronously
    // during the effect body.
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const handleFollow = async () => {
    if (!actorUri.trim()) return;
    setSubmitting(true);
    try {
      await followRemoteActor(actorUri.trim());
      notify('success', { title: 'Follow sent', text: 'Follow request queued for delivery.' });
      setActorUri('');
      load();
    } catch {
      notify('error', { title: 'Follow failed', text: 'Could not send follow request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnfollow = async (uri: string) => {
    await unfollowRemoteActor(uri);
    notify('success', { title: 'Unfollowed', text: 'Unfollow sent.' });
    load();
  };

  const renderState = getListRenderState(loading, following.length === 0);

  return (
    <SectionCard title="Following">
      <div className="flex gap-2">
        <input
          type="text"
          value={actorUri}
          onChange={(e) => setActorUri(e.target.value)}
          placeholder="https://other-clinic.example/ap/organizations/abc"
          className="flex-1 text-body-4 border border-card-border rounded-lg px-3 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Primary
          href="#"
          text={submitting ? 'Sending...' : 'Follow'}
          onClick={handleFollow}
          isDisabled={submitting || !actorUri.trim()}
        />
      </div>
      {renderState === 'loading' && <div className={TEXT_MUTED}>Loading...</div>}
      {renderState === 'empty' && (
        <div className={TEXT_MUTED}>Not following any instances yet.</div>
      )}
      {renderState === 'ready' && (
        <div className="flex flex-col gap-3">
          {following.map((f) => (
            <div key={f.id} className={ROW_CLS}>
              <div className={ROW_META_CLS}>
                <div className="text-body-4 text-text-primary truncate">{f.remoteActorUri}</div>
                <StateBadge state={f.state} />
              </div>
              <button
                type="button"
                onClick={() => handleUnfollow(f.remoteActorUri)}
                className={`${TEXT_MUTED} hover:text-danger-600 shrink-0`}
              >
                Unfollow
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

const ReferralRow = ({
  referral,
  direction,
  onRespond,
}: {
  referral: APReferral;
  direction: 'in' | 'out';
  onRespond?: (action: 'accept' | 'decline') => void;
}) => (
  <div className="flex flex-col gap-1 py-3 border-b border-b-card-border last:border-b-0">
    <div className="flex items-center gap-2 flex-wrap">
      <StateBadge state={referral.state} />
      <span className={`text-body-4 font-medium ${URGENCY_COLORS[referral.urgency]}`}>
        {URGENCY_LABELS[referral.urgency]}
      </span>
      <span className={TEXT_MUTED}>
        {direction === 'in' ? `from ${referral.fromActorUri}` : `to ${referral.toActorUri}`}
      </span>
    </div>
    <div className="text-body-4 text-text-primary">
      {referral.patientSummary.species}
      {referral.patientSummary.breed ? ` - ${referral.patientSummary.breed}` : ''}
      {referral.patientSummary.age ? `, ${referral.patientSummary.age}` : ''}
    </div>
    <div className={TEXT_MUTED}>{referral.patientSummary.chiefComplaint}</div>
    {referral.clinicalContext && (
      <div className="text-body-4 text-text-tertiary italic">{referral.clinicalContext}</div>
    )}
    {direction === 'in' && referral.state === 'PENDING' && onRespond && (
      <div className="flex gap-2 mt-1">
        <Primary text="Accept" onClick={() => onRespond('accept')} />
        <Primary text="Decline" onClick={() => onRespond('decline')} />
      </div>
    )}
  </div>
);

const ReferralInboxCard = () => {
  const { notify } = useNotify();
  const [inbound, setInbound] = useState<APReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    listInboundReferrals().then((data) => {
      if (data) setInbound(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRespond = useCallback(
    async (referralId: string, action: 'accept' | 'decline') => {
      try {
        await respondToReferral(referralId, action);
        notify('success', {
          title: 'Referral updated',
          text: `Referral ${action === 'accept' ? 'accepted' : 'declined'}.`,
        });
        reload();
      } catch {
        notify('error', { title: 'Action failed', text: `Could not ${action} referral.` });
      }
    },
    [notify, reload]
  );

  const renderState = getListRenderState(loading, inbound.length === 0);

  return (
    <SectionCard title="Inbound referrals">
      {renderState === 'loading' && <div className={TEXT_MUTED}>Loading...</div>}
      {renderState === 'empty' && <div className={TEXT_MUTED}>No inbound referrals yet.</div>}
      {renderState === 'ready' && (
        <div className="flex flex-col">
          {inbound.map((r) => (
            <ReferralRow
              key={r.id}
              referral={r}
              direction="in"
              onRespond={(action) => handleRespond(r.id, action)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
};

const REFERRAL_INPUT_CLS =
  'w-full text-body-4 border border-card-border rounded-lg px-3 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary';

const EMPTY_REFERRAL: SendReferralPayload = {
  toActorUri: '',
  patientSummary: { species: '', chiefComplaint: '' },
  urgency: 'ROUTINE',
};

/** One labelled text input. Five near-identical blocks collapsed into one. */
const ReferralField = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  wide,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <label htmlFor={id} className={FIELD_LABEL_CLS}>
      {label}
    </label>
    <input
      id={id}
      className={REFERRAL_INPUT_CLS}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/** Form state and submission, kept out of the rendering component. */
const useReferralForm = (notify: ReturnType<typeof useNotify>['notify']) => {
  const [outbound, setOutbound] = useState<APReferral[]>([]);
  const [loadingOutbound, setLoadingOutbound] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SendReferralPayload>(EMPTY_REFERRAL);

  useEffect(() => {
    listOutboundReferrals().then((data) => {
      if (data) setOutbound(data);
      setLoadingOutbound(false);
    });
  }, []);

  const update = (key: keyof SendReferralPayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateSummary = (key: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      patientSummary: { ...prev.patientSummary, [key]: value },
    }));

  const incomplete =
    !form.toActorUri || !form.patientSummary.species || !form.patientSummary.chiefComplaint;

  const handleSubmit = async () => {
    if (incomplete) return;
    setSubmitting(true);
    try {
      await sendReferral(form);
      notify('success', { title: 'Referral sent', text: 'Referral queued for delivery.' });
      setForm(EMPTY_REFERRAL);
      const data = await listOutboundReferrals();
      if (data) setOutbound(data);
    } catch {
      notify('error', { title: 'Failed', text: 'Could not send referral.' });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    update,
    updateSummary,
    submitting,
    incomplete,
    handleSubmit,
    outbound,
    loadingOutbound,
  };
};

const ReferralFormFields = ({
  form,
  update,
  updateSummary,
}: {
  form: SendReferralPayload;
  update: (key: keyof SendReferralPayload, value: unknown) => void;
  updateSummary: (key: string, value: string) => void;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <ReferralField
      id="referral-to-actor-uri"
      label="Recipient actor URI *"
      placeholder="Recipient actor URI"
      value={form.toActorUri}
      onChange={(v) => update('toActorUri', v)}
      wide
    />
    <ReferralField
      id="referral-species"
      label="Species *"
      placeholder="e.g. Canine"
      value={form.patientSummary.species}
      onChange={(v) => updateSummary('species', v)}
    />
    <ReferralField
      id="referral-breed"
      label="Breed"
      placeholder="e.g. Labrador"
      value={form.patientSummary.breed ?? ''}
      onChange={(v) => updateSummary('breed', v)}
    />
    <ReferralField
      id="referral-age"
      label="Age"
      placeholder="e.g. 3 years"
      value={form.patientSummary.age ?? ''}
      onChange={(v) => updateSummary('age', v)}
    />
    <div>
      <label htmlFor="referral-urgency" className={FIELD_LABEL_CLS}>
        Urgency
      </label>
      <select
        id="referral-urgency"
        className={REFERRAL_INPUT_CLS}
        value={form.urgency}
        onChange={(e) => update('urgency', e.target.value as APReferralUrgency)}
      >
        <option value="ROUTINE">Routine</option>
        <option value="URGENT">Urgent</option>
        <option value="EMERGENCY">Emergency</option>
      </select>
    </div>
    <ReferralField
      id="referral-chief-complaint"
      label="Chief complaint *"
      placeholder="Primary reason for referral"
      value={form.patientSummary.chiefComplaint}
      onChange={(v) => updateSummary('chiefComplaint', v)}
      wide
    />
    <div className="md:col-span-2">
      <label htmlFor="referral-clinical-context" className={FIELD_LABEL_CLS}>
        Clinical context
      </label>
      <textarea
        id="referral-clinical-context"
        className={`${REFERRAL_INPUT_CLS} resize-none`}
        rows={3}
        placeholder="History, diagnostics, current treatment..."
        value={form.clinicalContext ?? ''}
        onChange={(e) => update('clinicalContext', e.target.value)}
      />
    </div>
  </div>
);

const SentReferralsList = ({ outbound }: { outbound: APReferral[] }) => (
  <div className="border-t border-card-border pt-4">
    <div className={`${TEXT_MUTED} mb-3`}>Sent referrals</div>
    {outbound.map((r) => (
      <ReferralRow key={r.id} referral={r} direction="out" />
    ))}
  </div>
);

const SendReferralCard = () => {
  const { notify } = useNotify();
  const {
    form,
    update,
    updateSummary,
    submitting,
    incomplete,
    handleSubmit,
    outbound,
    loadingOutbound,
  } = useReferralForm(notify);

  return (
    <SectionCard title="Send referral">
      <ReferralFormFields form={form} update={update} updateSummary={updateSummary} />
      <div className="flex justify-end">
        <Primary
          href="#"
          text={submitting ? 'Sending...' : 'Send referral'}
          onClick={handleSubmit}
          isDisabled={submitting || incomplete}
        />
      </div>
      {!loadingOutbound && outbound.length > 0 && <SentReferralsList outbound={outbound} />}
    </SectionCard>
  );
};

const EmergencyCard = () => {
  const { notify } = useNotify();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAnnounce = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await announceEmergency(content.trim(), 'EMERGENCY');
      notify('success', {
        title: 'Emergency announced',
        text: 'Broadcast queued to all followers.',
      });
      setContent('');
    } catch {
      notify('error', { title: 'Failed', text: 'Could not send emergency announcement.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard title="Emergency broadcast">
      <div className={TEXT_MUTED}>
        Announces an emergency to all approved followers across the federation network.
      </div>
      <textarea
        className="w-full text-body-4 border border-card-border rounded-lg px-3 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        rows={3}
        placeholder="Describe the emergency or critical notice..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAnnounce}
          disabled={submitting || !content.trim()}
          className="px-4 py-2 rounded-xl text-body-4 font-medium bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? 'Sending...' : 'Broadcast emergency'}
        </button>
      </div>
    </SectionCard>
  );
};

const FederationSection = () => {
  const { notify } = useNotify();
  const [actor, setActor] = useState<APActorSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActor = useCallback(() => {
    setLoading(true);
    getActorSettings()
      .then((data) => setActor(data))
      .catch(() => {
        notify('error', {
          title: 'Federation unavailable',
          text: 'Could not load actor settings.',
        });
      })
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    // `loadActor` is also the refresh callback for the license and directory
    // cards, so its leading setLoading(true) has to stay for those callers. On
    // mount it is a no-op, since `loading` already starts true and React bails
    // out of a re-render for an unchanged value.
    const run = async () => {
      await loadActor();
    };
    run();
  }, [loadActor]);

  if (loading) {
    return <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />;
  }

  if (!actor) return null;

  return (
    <div className="flex flex-col gap-6">
      <ActorInfoCard actor={actor} />
      <LicenseTokenCard status={actor.licenseTokenStatus} onUpdated={loadActor} />
      <DirectoryListingCard
        isVerified={actor.isVerified}
        directoryListed={actor.directoryListed}
        onUpdated={loadActor}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FollowersCard />
        <FollowingCard />
      </div>
      <ReferralInboxCard />
      <SendReferralCard />
      <EmergencyCard />
    </div>
  );
};

export default FederationSection;
