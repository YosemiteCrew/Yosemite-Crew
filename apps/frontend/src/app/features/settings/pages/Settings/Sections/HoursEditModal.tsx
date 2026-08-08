import React, { useEffect, useState, startTransition } from 'react';
import { IoGlobeOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
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

// `_id` comes off the store untyped. Only a primitive is a usable organisation
// id, so anything else resolves to '' instead of stringifying to '[object Object]'.
const toOrgId = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

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
        organisationId: primaryOrgId ?? toOrgId(org?._id),
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
 * Editable availability state: seeds from the org snapshot, or from the signed-in
 * practitioner's saved profile when there is one.
 */
const useEditableAvailability = (practitionerReference: string | undefined) => {
  const { availabilities } = usePrimaryAvailability();
  const [availability, setAvailability] = useState<AvailabilityState>(buildDefaultAvailability);

  // Render-phase adjustment: seed from the store snapshot (org-level fallback only).
  const [syncedAvailabilities, setSyncedAvailabilities] = useState<typeof availabilities | null>(
    null
  );
  if (availabilities && !practitionerReference && availabilities !== syncedAvailabilities) {
    setSyncedAvailabilities(availabilities);
    setAvailability(availabilities);
  }

  useEffect(() => {
    if (!practitionerReference) return;
    let cancelled = false;

    (async () => {
      const data = await getProfileForUserForPrimaryOrg(practitionerReference);
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
  }, [practitionerReference]);

  return [availability, setAvailability] as const;
};

/**
 * Orchestrates the availability save flow, kept out of the modal component so the
 * component stays a thin presentational shell.
 */
const useAvailabilityHours = (setShowModal: HoursEditModalProps['setShowModal']) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const { org, membership } = usePrimaryOrgWithMembership();
  const { notify } = useNotify();
  const [availability, setAvailability] = useEditableAvailability(
    membership?.practitionerReference
  );
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

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
      <ModalHeader
        title="Availability & consultation hours"
        meta={subtitle}
        titleId="settings-hours-modal-title"
        onClose={() => setShowModal(false)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
        <Availability availability={availability} setAvailability={setAvailability} />
      </div>

      <ModalFooter>
        <span className="yc-settings-tz-note mr-auto">
          <IoGlobeOutline size={14} aria-hidden="true" className="yc-settings-tz-note-icon" />
          {getPreferredTimeZone()} · booking slots follow each service&apos;s duration
        </span>
        <Secondary text="Cancel" href="#" onClick={() => setShowModal(false)} />
        <Primary
          href="#"
          text={isSavingAvailability ? 'Saving...' : 'Save availability'}
          onClick={handleSaveAvailability}
          isDisabled={isSavingAvailability}
        />
      </ModalFooter>
    </Modal>
  );
};

export default HoursEditModal;
