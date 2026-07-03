'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { Primary } from '@/app/ui/primitives/Buttons';
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
  URGENT: 'text-yellow-600',
  EMERGENCY: 'text-red-600',
};

const BADGE_SUCCESS = 'bg-green-100 text-green-800';
const BADGE_DANGER = 'bg-red-100 text-red-800';
const BADGE_NEUTRAL = 'bg-gray-200 text-gray-700';
const BADGE_MUTED = 'bg-gray-100 text-gray-600';

const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
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

const StateBadge = ({ state }: { state: string }) => {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: BADGE_SUCCESS,
    ACCEPTED: BADGE_SUCCESS,
    REJECTED: BADGE_DANGER,
    DECLINED: BADGE_DANGER,
    BLOCKED: BADGE_NEUTRAL,
    CANCELLED: BADGE_NEUTRAL,
  };
  return (
    <span className={`${BADGE_BASE} ${colors[state] ?? BADGE_MUTED}`}>
      {state.charAt(0) + state.slice(1).toLowerCase()}
    </span>
  );
};

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
  { label: string; color: string; hint: string }
> = {
  none: {
    label: 'Not set',
    color: BADGE_MUTED,
    hint: 'Paste the license token issued by Yosemite Crew below to enable federation.',
  },
  valid: {
    label: 'Verified',
    color: BADGE_SUCCESS,
    hint: 'This instance is verified and can federate with other Yosemite Crew instances.',
  },
  invalid: {
    label: 'Invalid / expired',
    color: 'bg-red-100 text-red-700',
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
        <span className={`${BADGE_BASE} ${config.color}`}>{config.label}</span>
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
    load();
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
                    onClick={() => handleApprove(f.remoteActorUri)}
                    className="text-body-4 text-green-700 hover:text-green-900"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(f.remoteActorUri)}
                    className="text-body-4 text-red-600 hover:text-red-800"
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
    load();
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
                onClick={() => handleUnfollow(f.remoteActorUri)}
                className={`${TEXT_MUTED} hover:text-red-600 shrink-0`}
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

const SendReferralCard = () => {
  const { notify } = useNotify();
  const [outbound, setOutbound] = useState<APReferral[]>([]);
  const [loadingOutbound, setLoadingOutbound] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SendReferralPayload>({
    toActorUri: '',
    patientSummary: { species: '', chiefComplaint: '' },
    urgency: 'ROUTINE',
  });

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

  const handleSubmit = async () => {
    if (!form.toActorUri || !form.patientSummary.species || !form.patientSummary.chiefComplaint)
      return;
    setSubmitting(true);
    try {
      await sendReferral(form);
      notify('success', { title: 'Referral sent', text: 'Referral queued for delivery.' });
      setForm({
        toActorUri: '',
        patientSummary: { species: '', chiefComplaint: '' },
        urgency: 'ROUTINE',
      });
      const data = await listOutboundReferrals();
      if (data) setOutbound(data);
    } catch {
      notify('error', { title: 'Failed', text: 'Could not send referral.' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full text-body-4 border border-card-border rounded-lg px-3 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <SectionCard title="Send referral">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label htmlFor="referral-to-actor-uri" className={FIELD_LABEL_CLS}>
            Recipient actor URI *
          </label>
          <input
            id="referral-to-actor-uri"
            className={inputCls}
            placeholder="Recipient actor URI"
            value={form.toActorUri}
            onChange={(e) => update('toActorUri', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="referral-species" className={FIELD_LABEL_CLS}>
            Species *
          </label>
          <input
            id="referral-species"
            className={inputCls}
            placeholder="e.g. Canine"
            value={form.patientSummary.species}
            onChange={(e) => updateSummary('species', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="referral-breed" className={FIELD_LABEL_CLS}>
            Breed
          </label>
          <input
            id="referral-breed"
            className={inputCls}
            placeholder="e.g. Labrador"
            value={form.patientSummary.breed ?? ''}
            onChange={(e) => updateSummary('breed', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="referral-age" className={FIELD_LABEL_CLS}>
            Age
          </label>
          <input
            id="referral-age"
            className={inputCls}
            placeholder="e.g. 3 years"
            value={form.patientSummary.age ?? ''}
            onChange={(e) => updateSummary('age', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="referral-urgency" className={FIELD_LABEL_CLS}>
            Urgency
          </label>
          <select
            id="referral-urgency"
            className={inputCls}
            value={form.urgency}
            onChange={(e) => update('urgency', e.target.value as APReferralUrgency)}
          >
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="referral-chief-complaint" className={FIELD_LABEL_CLS}>
            Chief complaint *
          </label>
          <input
            id="referral-chief-complaint"
            className={inputCls}
            placeholder="Primary reason for referral"
            value={form.patientSummary.chiefComplaint}
            onChange={(e) => updateSummary('chiefComplaint', e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="referral-clinical-context" className={FIELD_LABEL_CLS}>
            Clinical context
          </label>
          <textarea
            id="referral-clinical-context"
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="History, diagnostics, current treatment..."
            value={form.clinicalContext ?? ''}
            onChange={(e) => update('clinicalContext', e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Primary
          href="#"
          text={submitting ? 'Sending...' : 'Send referral'}
          onClick={handleSubmit}
          isDisabled={
            submitting ||
            !form.toActorUri ||
            !form.patientSummary.species ||
            !form.patientSummary.chiefComplaint
          }
        />
      </div>
      {!loadingOutbound && outbound.length > 0 && (
        <div className="border-t border-card-border pt-4">
          <div className={`${TEXT_MUTED} mb-3`}>Sent referrals</div>
          {outbound.map((r) => (
            <ReferralRow key={r.id} referral={r} direction="out" />
          ))}
        </div>
      )}
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
          onClick={handleAnnounce}
          disabled={submitting || !content.trim()}
          className="px-4 py-2 rounded-xl text-body-4 font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
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
    loadActor();
  }, [loadActor]);

  if (loading) {
    return <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />;
  }

  if (!actor) return null;

  return (
    <div className="flex flex-col gap-6">
      <ActorInfoCard actor={actor} />
      <LicenseTokenCard status={actor.licenseTokenStatus} onUpdated={loadActor} />
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
