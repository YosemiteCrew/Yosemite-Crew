'use client';
import React, { useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';

import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import InviteCard from '@/app/ui/cards/InviteCard/InviteCard';
import { Invite } from '@/app/features/organization/types/team';
import { acceptInvite, rejectInvite } from '@/app/features/organization/services/teamService';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { toTitleCase, toTitle } from '@/app/lib/validators';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type OrgInvitesProps = {
  invites: Invite[];
  setInvites: React.Dispatch<React.SetStateAction<Invite[]>>;
  onAccepting: (accepting: boolean) => void;
  onNavigate: (path: string) => void;
};

const OrgInvites = ({ invites, setInvites, onAccepting, onNavigate }: OrgInvitesProps) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (invite: Invite) => {
    setProcessingId(invite._id);
    onAccepting(true);
    try {
      await acceptInvite(invite);
      // Remove from invites list immediately after accept succeeds
      setInvites((prev) => prev.filter((i) => i._id !== invite._id));
      // Resolve correct next screen — team-onboarding if profile incomplete, else default landing
      const nextRoute = await resolveOrgScopedRedirect({
        orgId: invite.organisationId,
      });
      onNavigate(nextRoute);
    } catch {
      onAccepting(false);
      setProcessingId(null);
    }
  };

  const handleReject = async (invite: Invite) => {
    setProcessingId(invite._id);
    try {
      await rejectInvite(invite);
      setInvites((prev) => prev.filter((i) => i._id !== invite._id));
    } catch {
      // silent — invite stays in list if reject fails
    } finally {
      setProcessingId(null);
    }
  };

  const columns: Column<Invite>[] = [
    {
      label: 'Name',
      key: 'name',
      width: '25%',
      render: (item: Invite) => <div className="InviteDetails">{item.organisationName}</div>,
    },
    {
      label: 'Type',
      key: 'type',
      width: '20%',
      render: (item: Invite) => (
        <div className="InviteTime">{toTitleCase(item.organisationType)}</div>
      ),
    },
    {
      label: 'Role',
      key: 'role',
      width: '20%',
      render: (item: Invite) => <div className="InviteExpires">{toTitleCase(item.role)}</div>,
    },
    {
      label: 'Employee type',
      key: 'employee-type',
      width: '20%',
      render: (item: Invite) => <div className="InviteExpires">{toTitle(item.employmentType)}</div>,
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '15%',
      render: (item: Invite) => {
        const isProcessing = processingId === item._id;
        return (
          <div className="action-btn-col">
            <button
              onClick={() => handleAccept(item)}
              disabled={isProcessing || processingId !== null}
              className="action-btn"
              style={{ background: 'var(--color-success-100)', opacity: isProcessing ? 0.5 : 1 }}
              aria-label="Accept invite"
            >
              <FaCheckCircle size={22} color="var(--color-success-400)" />
            </button>
            <button
              onClick={() => handleReject(item)}
              disabled={isProcessing || processingId !== null}
              className="action-btn"
              style={{ background: 'var(--color-danger-100)', opacity: isProcessing ? 0.5 : 1 }}
              aria-label="Decline invite"
            >
              <IoIosCloseCircle size={24} color="var(--color-danger-600)" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable data={invites} columns={columns} bordered={false} pageSize={5} pagination />
      </div>
      <div className="card-list">
        {invites.length === 0 ? (
          <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
            No pending invites
          </div>
        ) : (
          invites.map((invite, index) => (
            <InviteCard
              key={invite._id + index}
              invite={invite}
              handleAccept={handleAccept}
              handleReject={handleReject}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default OrgInvites;
