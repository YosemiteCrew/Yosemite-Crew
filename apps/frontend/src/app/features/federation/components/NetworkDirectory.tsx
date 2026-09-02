'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { IoCloudOfflineOutline, IoGlobeOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import '@/app/ui/layout/states/states.css';
import type { APDirectoryClinic } from '@/app/features/federation/types/federation';
import {
  followRemoteActor,
  listDirectory,
} from '@/app/features/federation/services/federationService';

type DirectoryRenderState = 'loading' | 'empty' | 'ready';

const getDirectoryRenderState = (loading: boolean, isEmpty: boolean): DirectoryRenderState => {
  if (loading) return 'loading';
  if (isEmpty) return 'empty';
  return 'ready';
};

// Page-header contract (serif title, subtitle, actions right) shared with every
// other PIMS page; this page used to put its title inside a bordered card and
// had no H1 at all.
const DirectoryHeader = ({ count }: { count: number | null }) => (
  <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
    <div className="flex min-w-0 flex-col gap-[3px]">
      <h1 className="text-page-title">
        Network{' '}
        {count === null ? null : <span className="text-page-title-count">{`(${count})`}</span>}
      </h1>
      <p className="text-[13.5px] text-[var(--ink-muted)]">
        Clinics that have opted in to the federation directory. Follow a clinic to enable referrals
        and messaging with them.
      </p>
    </div>
  </div>
);

// One loading / empty / error recipe (the shared --screen state card), so an
// outage and "nobody has listed yet" no longer read as the same muted line.
const DirectoryState = ({
  tone,
  title,
  text,
  action,
}: {
  tone: 'loading' | 'empty' | 'error';
  title: string;
  text: string;
  action?: React.ReactNode;
}) => (
  <div className="yc-state-card" role={tone === 'error' ? 'alert' : 'status'}>
    <span
      className={`yc-state-icon ${tone === 'error' ? 'yc-state-icon--warn' : 'yc-state-icon--blue'}`}
      aria-hidden
    >
      {tone === 'error' ? <IoCloudOfflineOutline size={24} /> : <IoGlobeOutline size={24} />}
    </span>
    <div className="yc-state-title">{title}</div>
    <p className="yc-state-text">{text}</p>
    {action ? <div className="yc-state-actions">{action}</div> : null}
  </div>
);

const ClinicCard = ({
  clinic,
  onFollow,
  following,
}: {
  clinic: APDirectoryClinic;
  onFollow: (clinic: APDirectoryClinic) => void;
  following: boolean;
}) => (
  <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] p-4 shadow-[0_1px_2px_var(--sh03)]">
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="truncate text-[14px] font-bold text-[var(--ink)]">{clinic.orgName}</div>
      <div className="truncate text-[12.5px] text-[var(--ink-muted)]">{clinic.handle}</div>
      <div className="truncate text-[12px] text-[var(--ink-faint)]">{clinic.instanceHost}</div>
    </div>
    <div className="flex justify-end">
      <Primary
        href="#"
        size="small"
        text={following ? 'Following...' : 'Follow'}
        onClick={() => onFollow(clinic)}
        isDisabled={following}
      />
    </div>
  </div>
);

const NetworkDirectory = () => {
  const { notify } = useNotify();
  const [clinics, setClinics] = useState<APDirectoryClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingUri, setFollowingUri] = useState<string | null>(null);
  // Distinct from "no clinics": a failed load used to fall through to the empty
  // state, so an unreachable or disabled federation service read as "nobody has
  // listed yet" and looked like the feature was simply doing nothing.
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    // No setLoading(true) here: this runs once from the mount effect and
    // `loading` already starts true, so the only effect of setting it again
    // would be a synchronous state write during the effect body.
    try {
      const data = await listDirectory();
      setClinics(data.clinics);
      // The backend degrades gracefully when the authority is unreachable, so a
      // successful response can still mean "could not load". Trust its flag.
      setUnavailable(Boolean(data.unavailable));
    } catch {
      setUnavailable(true);
      notify('error', {
        title: 'Directory unavailable',
        text: 'Could not load the clinic directory.',
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // Wrapped rather than called directly: the hooks lint cannot see through the
    // useCallback to prove the setStates all happen after an await, and flags a
    // bare `load()` as a synchronous state write.
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const handleFollow = useCallback(
    async (clinic: APDirectoryClinic) => {
      setFollowingUri(clinic.actorUri);
      try {
        await followRemoteActor(clinic.actorUri);
        notify('success', {
          title: 'Follow sent',
          text: `Follow request sent to ${clinic.orgName}.`,
        });
      } catch {
        notify('error', { title: 'Follow failed', text: 'Could not send follow request.' });
      } finally {
        setFollowingUri(null);
      }
    },
    [notify]
  );

  const renderState = getDirectoryRenderState(loading, clinics.length === 0);

  const retry = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    await load();
  }, [load]);

  return (
    <div className="flex flex-col gap-[14px]">
      <DirectoryHeader count={renderState === 'ready' ? clinics.length : null} />
      {renderState === 'loading' && (
        <DirectoryState
          tone="loading"
          title="Loading..."
          text="Fetching the clinics that have opted in to the directory."
        />
      )}
      {renderState === 'empty' && unavailable && (
        <DirectoryState
          tone="error"
          title="Clinic directory unavailable"
          text="The clinic directory is unavailable. Federation may be switched off on this instance, or the directory service cannot be reached."
          action={<Secondary text="Retry" onClick={retry} />}
        />
      )}
      {renderState === 'empty' && !unavailable && (
        <DirectoryState
          tone="empty"
          title="No clinics yet"
          text="No clinics are listed in the directory yet."
        />
      )}
      {renderState === 'ready' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinics.map((clinic) => (
            <ClinicCard
              key={clinic.actorUri}
              clinic={clinic}
              onFollow={handleFollow}
              following={followingUri === clinic.actorUri}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NetworkDirectory;
