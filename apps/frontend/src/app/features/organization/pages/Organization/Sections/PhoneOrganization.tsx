import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  IoAdd,
  IoArrowBack,
  IoCheckmark,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoCreateOutline,
  IoShieldCheckmark,
} from 'react-icons/io5';
import { Organisation, Service } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { loadServicesForOrg } from '@/app/features/organization/services/serviceService';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { getSafeImageUrl } from '@/app/lib/urls';
import AddTeam from '@/app/features/organization/pages/Organization/Sections/Team/AddTeam';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import OrgProfileEditCards from '@/app/features/organization/pages/Organization/Sections/OrgProfileEditCards';
import { useOrgProfileForm } from '@/app/features/organization/pages/Organization/Sections/useOrgProfileForm';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  COMPLETED_PILL_TOKENS,
  UPCOMING_PILL_TOKENS,
  avatarAccentFor,
  humanize,
  initialsOf,
  orgTypePillLabel,
  teamStatusPill,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';

type PhoneOrganizationProps = {
  primaryOrg: Organisation;
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
    {children}
  </span>
);

const specialityNamesOf = (team: TeamProp): string => {
  if (!Array.isArray(team.speciality) || team.speciality.length === 0) return '';
  return team.speciality
    .flatMap((spec) => {
      const name = typeof spec === 'string' ? spec : (spec?.name ?? '');
      return name ? [name] : [];
    })
    .join(', ');
};

const teamSubline = (team: TeamProp): string => {
  const employment = (team as { employmentType?: string }).employmentType;
  return [humanize(team.role), specialityNamesOf(team), humanize(employment)]
    .filter(Boolean)
    .join(' · ');
};

const serviceMeta = (service: Service): string => {
  const parts: string[] = [];
  if (typeof service.durationMinutes === 'number') parts.push(`${service.durationMinutes} min`);
  if (typeof service.cost === 'number') parts.push(`€${service.cost}`);
  if (service.serviceType === 'OBSERVATION_TOOL') parts.push('observation tool');
  return parts.join(' · ');
};

const ProfileCardCompact = ({ org }: { org: Organisation }) => {
  const addr = org.address;
  const line1 = [
    [addr?.addressLine, [addr?.postalCode, addr?.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
    org.phoneNo,
  ]
    .filter(Boolean)
    .join(' · ');
  const line2 = [org.website, org.taxId ? `Tax ${org.taxId}` : ''].filter(Boolean).join(' · ');

  return (
    <div className="flex gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-[14px]! shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]">
      {org.imageURL ? (
        <Image
          src={getSafeImageUrl(org.imageURL, 'business')}
          alt=""
          height={48}
          width={48}
          unoptimized
          className="size-12 flex-none rounded-[14px] object-cover"
        />
      ) : (
        <span className="flex size-12 flex-none items-center justify-center rounded-[14px] bg-[var(--blue-soft)] text-[18px] font-bold text-[var(--blue-text)]">
          {initialsOf(org.name).charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-[6px]">
          <span className="text-[15px] font-bold text-[var(--ink)]">
            {org.name || 'Organization'}
          </span>
          {org.isVerified && (
            <StatusPill
              tokens={COMPLETED_PILL_TOKENS}
              label={
                <>
                  <IoShieldCheckmark size={8} aria-hidden="true" />
                  VERIFIED
                </>
              }
            />
          )}
          <StatusPill label={orgTypePillLabel(org.type)} tokens={UPCOMING_PILL_TOKENS} />
        </span>
        <span className="mt-[3px] block text-[11px] leading-[1.45] text-[var(--ink-faint)]">
          {line1}
          {line2 && (
            <>
              <br />
              {line2}
            </>
          )}
        </span>
      </span>
    </div>
  );
};

const TeamListRow = ({ team, onOpen }: { team: TeamProp; onOpen: (team: TeamProp) => void }) => {
  const pill = teamStatusPill(team.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(team)}
      className="flex w-full items-center gap-[10px] border-t border-[var(--hairline)] px-[14px]! py-[11px]! text-left first:border-t-0 cursor-pointer"
    >
      {team.image ? (
        <Image
          src={getSafeImageUrl(team.image, 'person')}
          alt=""
          height={32}
          width={32}
          className="size-8 flex-none rounded-full object-cover"
        />
      ) : (
        <span
          className={`flex size-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${avatarAccentFor(team._id || team.name || '')}`}
        >
          {initialsOf(team.name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">
          {team.name || 'Team member'}
        </span>
        <span className="block truncate text-[10.5px] text-[var(--ink-faint)]">
          {teamSubline(team) || '—'}
        </span>
      </span>
      <StatusPill label={pill.label} tokens={pill.tokens} className="flex-none" />
    </button>
  );
};

const SpecialityAccordion = ({ specialities }: { specialities: SpecialityWeb[] }) => {
  // `undefined` means the user has not toggled yet, so the first speciality stays
  // open by default and follows changes to the `specialities` prop; `null` means
  // the user collapsed everything; a string is the id the user opened.
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const openId = selectedId === undefined ? specialities[0]?._id : selectedId;

  if (specialities.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-[14px]! py-[14px]! text-[12px] text-[var(--ink-faint)] shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]">
        No specialities added yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]">
      {specialities.map((speciality) => {
        const isOpen = openId === speciality._id;
        const serviceCount = speciality.activeServiceCount ?? speciality.services?.length ?? 0;
        return (
          <div key={speciality._id} className="border-t border-[var(--hairline)] first:border-t-0">
            <button
              type="button"
              onClick={() => setSelectedId(isOpen ? null : speciality._id)}
              className="flex w-full items-center justify-between gap-2 px-[14px]! py-3! text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <span className="text-[12.5px] font-bold text-[var(--ink)]">
                {speciality.name}
                <span className="font-medium text-[var(--ink-faint)]">
                  {' '}
                  · {serviceCount} services
                </span>
              </span>
              {isOpen ? (
                <IoChevronDownOutline
                  size={14}
                  className="text-[var(--ink-faint)]"
                  aria-hidden="true"
                />
              ) : (
                <IoChevronForwardOutline
                  size={14}
                  className="text-[var(--ink-faint)]"
                  aria-hidden="true"
                />
              )}
            </button>
            {isOpen &&
              (speciality.services ?? []).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] bg-[var(--surface-soft)] px-[14px]! py-[10px]!"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-[var(--ink)]">
                      {service.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-[var(--ink-faint)]">
                      {serviceMeta(service)}
                    </span>
                  </span>
                  <IoChevronForwardOutline
                    size={13}
                    className="flex-none text-[var(--ink-faint)]"
                    aria-hidden="true"
                  />
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};

const PhoneOrganization = ({ primaryOrg }: PhoneOrganizationProps) => {
  const router = useRouter();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesWithServiceNamesForPrimaryOrg();
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
  const canEditOrg = can(PERMISSIONS.ORG_EDIT);
  const canManageStripe = can({
    allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  });

  const form = useOrgProfileForm(primaryOrg);
  const [isEditing, setIsEditing] = useState(false);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(teams[0] ?? null);

  // The desktop Specialities panel loads the catalog on mount; the phone screen
  // must too, or the specialities accordion has no services to reveal when tapped.
  // Keep a missing id as undefined (never the string "undefined") so loadServicesForOrg can fall
  // back to the store's primary org id / skip, instead of fetching /organisation/undefined.
  const primaryOrgId = primaryOrg._id ? String(primaryOrg._id) : undefined;
  useEffect(() => {
    loadServicesForOrg(primaryOrgId).catch(() => {
      // Leave the accordion bodies empty if the load fails; the list still renders.
    });
  }, [primaryOrgId]);

  useEffect(() => {
    setActiveTeam((prev) => {
      if (teams.length === 0) return null;
      if (prev?._id) {
        const updated = teams.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return teams[0];
    });
  }, [teams]);

  const handleOpenTeam = (team: TeamProp) => {
    setActiveTeam(team);
    setViewPopup(true);
  };

  const stripeConnected = !!subscription?.connectChargesEnabled;
  const showManage = canManageStripe && !!subscription?.orgId;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-[54px] flex-none items-center gap-[10px] border-b border-[var(--hairline)] bg-[var(--screen)] px-[14px]!">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
          className="flex size-[34px] flex-none items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-soft)] cursor-pointer"
        >
          <IoArrowBack size={15} aria-hidden="true" />
        </button>
        <span className="flex-1 text-[15px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Organization
        </span>
        {canEditOrg && (
          <button
            type="button"
            aria-label={isEditing ? 'Done editing' : 'Edit organization'}
            onClick={() => setIsEditing((value) => !value)}
            className="flex size-[34px] flex-none items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-soft)] cursor-pointer"
          >
            {isEditing ? (
              <IoCheckmark size={16} aria-hidden="true" />
            ) : (
              <IoCreateOutline size={15} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-[11px] px-[18px]! py-[14px]!">
        {isEditing ? (
          <OrgProfileEditCards form={form} canEditOrg={canEditOrg} />
        ) : (
          <>
            <ProfileCardCompact org={form.formData} />

            <Eyebrow>Team · {teams.length}</Eyebrow>
            <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]">
              {teams.length === 0 ? (
                <div className="px-[14px]! py-[14px]! text-[12px] text-[var(--ink-faint)]">
                  No team members yet.
                </div>
              ) : (
                teams.map((team) => (
                  <TeamListRow key={team._id} team={team} onOpen={handleOpenTeam} />
                ))
              )}
              {canEditTeam && (
                <button
                  type="button"
                  onClick={() => setAddPopup(true)}
                  className="flex w-full items-center justify-center gap-[5px] border-t border-[var(--hairline)] px-[14px]! py-[11px]! text-[12px] font-semibold text-[var(--blue-text)] cursor-pointer"
                >
                  <IoAdd size={13} aria-hidden="true" />
                  Invite team member
                </button>
              )}
            </div>

            <Eyebrow>Specialities &amp; services</Eyebrow>
            <SpecialityAccordion specialities={specialities} />

            <div className="flex items-center gap-[10px] rounded-2xl border border-[var(--hairline)] px-[14px]! py-[11px]!">
              <span
                className={`mx-1 size-[7px] flex-none rounded-full ${
                  stripeConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--ink-faint2)]'
                }`}
                aria-hidden="true"
              />
              <span className="flex-1 text-[12px] font-semibold text-[var(--ink-body)]">
                {stripeConnected ? 'Stripe payments connected' : 'Stripe not connected'}
              </span>
              {showManage && (
                <a
                  href={`/stripe-onboarding?orgId=${subscription?.orgId}`}
                  className="text-[11.5px] font-semibold text-[var(--blue-text)]"
                >
                  {stripeConnected ? 'Manage' : 'Connect'}
                </a>
              )}
            </div>
          </>
        )}
      </div>

      <AddTeam showModal={addPopup} setShowModal={setAddPopup} />
      {activeTeam && (
        <TeamInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeTeam={activeTeam}
          canEditTeam={canEditTeam}
        />
      )}
    </div>
  );
};

export default PhoneOrganization;
