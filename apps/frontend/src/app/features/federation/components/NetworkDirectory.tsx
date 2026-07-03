'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import { Primary } from '@/app/ui/primitives/Buttons';
import type { APDirectoryClinic } from '@/app/features/federation/types/federation';
import {
  followRemoteActor,
  listDirectory,
} from '@/app/features/federation/services/federationService';

const TEXT_MUTED = 'text-body-4 text-text-secondary';

type DirectoryRenderState = 'loading' | 'empty' | 'ready';

const getDirectoryRenderState = (loading: boolean, isEmpty: boolean): DirectoryRenderState => {
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

const ClinicCard = ({
  clinic,
  onFollow,
  following,
}: {
  clinic: APDirectoryClinic;
  onFollow: (clinic: APDirectoryClinic) => void;
  following: boolean;
}) => (
  <div className="flex flex-col gap-2 p-4 border border-card-border rounded-2xl">
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="text-body-3 text-text-primary truncate">{clinic.orgName}</div>
      <div className={`${TEXT_MUTED} truncate`}>{clinic.handle}</div>
      <div className="text-body-4 text-text-tertiary truncate">{clinic.instanceHost}</div>
    </div>
    <div className="flex justify-end">
      <Primary
        href="#"
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDirectory();
      setClinics(data);
    } catch {
      notify('error', {
        title: 'Directory unavailable',
        text: 'Could not load the clinic directory.',
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
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

  return (
    <SectionCard title="Clinic directory">
      <div className={TEXT_MUTED}>
        Clinics that have opted in to the federation directory. Follow a clinic to enable referrals
        and messaging with them.
      </div>
      {renderState === 'loading' && <div className={TEXT_MUTED}>Loading...</div>}
      {renderState === 'empty' && (
        <div className={TEXT_MUTED}>No clinics are listed in the directory yet.</div>
      )}
      {renderState === 'ready' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    </SectionCard>
  );
};

export default NetworkDirectory;
