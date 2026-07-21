import React, { useEffect, useState, startTransition } from 'react';
import { IoGlobeOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import Close from '@/app/ui/primitives/Icons/Close';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  AvailabilityState,
  convertAvailability,
  convertFromGetApi,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import {
  upsertAvailability,
  upsertTeamAvailability,
} from '@/app/features/organization/services/availabilityService';
import { usePrimaryAvailability } from '@/app/hooks/useAvailabiities';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useNotify } from '@/app/hooks/useNotify';
import { getPreferredTimeZone } from '@/app/lib/timezone';
import '@/app/features/settings/styles/Settings.css';

type HoursEditModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const WEEKDAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

const buildDefaultAvailability = (): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = { enabled: WEEKDAYS.has(day), intervals: [{ ...DEFAULT_INTERVAL }] };
    return acc;
  }, {} as AvailabilityState);

type MembershipLike = { practitionerReference?: string; id?: string } | null | undefined;
type OrgLike = { _id?: unknown } | null | undefined;

// Convert the editable availability and persist it (team vs. org level). Returns
// false when nothing is enabled, so the caller can keep the editor open.
const persistAvailability = async (
  availability: AvailabilityState,
  membership: MembershipLike,
  org: OrgLike,
  primaryOrgId: string | null
): Promise<boolean> => {
  const converted = convertAvailability(availability);
  if (!hasAtLeastOneAvailability(converted)) return false;
  if (membership?.practitionerReference) {
    await upsertTeamAvailability(
      {
        _id: membership.id ?? membership.practitionerReference,
        practionerId: membership.practitionerReference,
        organisationId: primaryOrgId ?? String(org?._id ?? ''),
      } as any,
      converted,
      null
    );
  } else {
    await upsertAvailability(converted, null);
  }
  return true;
};

/**
 * Data layer for the availability editor: seeds the editable state from the store
 * snapshot (or the practitioner profile), and owns the save flow. Kept out of the
 * modal component so the component stays a thin presentational shell.
 */
const useAvailabilityHours = (setShowModal: HoursEditModalProps['setShowModal']) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { org, membership } = usePrimaryOrgWithMembership();
  const { availabilities } = usePrimaryAvailability();
  const { notify } = useNotify();

  const [availability, setAvailability] = useState<AvailabilityState>(buildDefaultAvailability);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  // Render-phase adjustment: seed the editable availability from the store
  // snapshot whenever a new snapshot arrives (org-level fallback only).
  const [syncedAvailabilities, setSyncedAvailabilities] = useState<typeof availabilities | null>(
    null
  );
  if (
    availabilities &&
    !membership?.practitionerReference &&
    availabilities !== syncedAvailabilities
  ) {
    setSyncedAvailabilities(availabilities);
    setAvailability(availabilities);
  }

  useEffect(() => {
    const practitionerId = membership?.practitionerReference;
    if (!practitionerId) return;
    let cancelled = false;

    (async () => {
      const data = await getProfileForUserForPrimaryOrg(practitionerId);
      if (cancelled) return;
      const response = data as { baseAvailability?: unknown };
      const baseAvailability = Array.isArray(response?.baseAvailability)
        ? response.baseAvailability
        : [];
      setAvailability(convertFromGetApi(baseAvailability));
    })().catch(() => {
      // A failed practitioner-profile load leaves the editable availability at its
      // default; the user can still set and save fresh hours from here.
    });

    return () => {
      cancelled = true;
    };
  }, [membership?.practitionerReference]);

  const handleSaveAvailability = async () => {
    if (isSavingAvailability) return;
    try {
      startTransition(() => setIsSavingAvailability(true));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      // Nothing enabled: leave the modal open so the user can pick a day.
      const saved = await persistAvailability(availability, membership, org, primaryOrgId);
      if (!saved) return;
      notify('success', {
        title: 'Availability updated',
        text: 'Availability have been updated successfully.',
      });
      setShowModal(false);
    } catch {
      notify('error', {
        title: 'Unable to update availability details',
        text: 'Failed to update availability details. Please try again.',
      });
    } finally {
      setIsSavingAvailability(false);
    }
  };

  return { availability, setAvailability, isSavingAvailability, handleSaveAvailability };
};

/**
 * Availability &amp; consultation hours editor, presented as the centered "Edit
 * hours" modal from the design (Settings · availability modal).
 */
const HoursEditModal = ({ showModal, setShowModal }: HoursEditModalProps) => {
  const attributes = useAuthStore((s) => s.attributes);
  const { availability, setAvailability, isSavingAvailability, handleSaveAvailability } =
    useAvailabilityHours(setShowModal);

  // Design subtitle: "<practitioner> · drives booking slots and the team planner",
  // collapsing to the trailing clause when the signed-in user has no name.
  const practitionerName =
    `${attributes?.given_name ?? ''} ${attributes?.family_name ?? ''}`.trim();
  const subtitle = [practitionerName, 'drives booking slots and the team planner']
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      variant="centered"
      size="lg"
      aria-labelledby="settings-hours-modal-title"
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--hairline)]">
        <div className="min-w-0">
          <div
            id="settings-hours-modal-title"
            className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]"
          >
            Availability &amp; consultation hours
          </div>
          <span className="yc-settings-editor-subtitle">{subtitle}</span>
        </div>
        <Close onClick={() => setShowModal(false)} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
        <Availability availability={availability} setAvailability={setAvailability} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--hairline)]">
        <span className="yc-settings-tz-note">
          <IoGlobeOutline size={14} aria-hidden="true" className="yc-settings-tz-note-icon" />
          {getPreferredTimeZone()} · booking slots follow each service&apos;s duration
        </span>
        <span className="flex items-center gap-2">
          <Secondary text="Cancel" href="#" onClick={() => setShowModal(false)} />
          <Primary
            href="#"
            text={isSavingAvailability ? 'Saving...' : 'Save availability'}
            onClick={handleSaveAvailability}
            isDisabled={isSavingAvailability}
          />
        </span>
      </div>
    </Modal>
  );
};

export default HoursEditModal;
