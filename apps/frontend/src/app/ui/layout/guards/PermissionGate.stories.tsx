import type { Meta, StoryObj } from '@storybook/react';
import type { UserOrganization } from '@yosemite-crew/types';

import PermissionGate from './PermissionGate';
import Fallback from '../../overlays/Fallback';
// Relative, not `@/`: the Storybook Vite build does not resolve the `@/` alias
// for runtime imports inside story files (type-only `@/` imports are erased
// before Rollup sees them, which is why they are safe elsewhere).
import { useOrgStore } from '../../../stores/orgStore';

const ORG_ID = 'org-storybook';

/**
 * A receptionist membership. `usePermissions` derives the effective set from
 * `roleCode` against the role table rather than from the stored
 * `effectivePermissions` snapshot, so seeding the role is enough — there is no
 * permission list to keep in sync here.
 */
const RECEPTIONIST: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
};

type OrgStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Seeds the org store the way bootstrap does and restores the previous state
 * when the story unmounts, so a seeded membership cannot leak into the next
 * story. Nothing here touches the network.
 */
const withMembership = (membership: UserOrganization | null, status: OrgStatus = 'loaded') => {
  return () => {
    const snapshot = useOrgStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: membership ? { [ORG_ID]: membership } : {},
      status,
    });

    return () => {
      useOrgStore.setState(snapshot);
    };
  };
};

/** Stand-in for whatever section the gate is wrapped around. */
const GatedPanel = () => (
  <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
    <p className="text-[15px] font-semibold text-[var(--ink-body)]">Today&apos;s appointments</p>
    <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
      12 booked, 3 awaiting confirmation. Visible because the role carries{' '}
      <code>appointments:view:any</code>.
    </p>
  </div>
);

/** The placeholder a caller passes as `skeleton` while memberships resolve. */
const PanelSkeleton = () => (
  <div className="h-[92px] animate-pulse rounded-[18px] bg-[var(--inset)]" aria-hidden="true" />
);

const meta = {
  title: 'Layout/PermissionGate',
  component: PermissionGate,
  parameters: {
    layout: 'padded',
    // The denied states render PermissionDeniedState, which calls
    // next/navigation's useRouter during render.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Renders its children only when the signed-in membership carries the required permissions. ' +
          'Permissions are derived from the org store, so these stories seed a membership rather than ' +
          'calling the API. What a denial looks like is the caller’s choice: pass `deniedResource` ' +
          'for the full page card, pass `fallback` for a compact section notice, or pass neither and ' +
          'the gate renders nothing at all.',
      },
    },
  },
  args: {
    anyOf: ['appointments:view:any'],
    children: <GatedPanel />,
  },
  beforeEach: withMembership(RECEPTIONIST),
} satisfies Meta<typeof PermissionGate>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The permission is held, so the gate is invisible and the section renders as
 * though it were not wrapped at all.
 */
export const Allowed: Story = {
  name: 'Allowed',
};

/**
 * A route-level denial. `audit:view:any` is not in the receptionist role, and
 * `deniedResource` turns that into the standard centred card naming the real
 * role rather than a blank screen.
 */
export const DeniedPageCard: Story = {
  name: 'Denied — page card',
  args: {
    anyOf: ['audit:view:any'],
    deniedResource: 'the audit trail',
    deniedDetail: 'who changed what and when',
  },
};

/**
 * The same denial inside a dashboard panel, where the full card would swamp the
 * layout. `fallback` wins over `deniedResource`, so the caller keeps control.
 */
export const DeniedInlineFallback: Story = {
  name: 'Denied — inline fallback',
  args: {
    anyOf: ['audit:view:any'],
    fallback: <Fallback resource="the audit trail" />,
  },
};

/**
 * Memberships have not resolved yet. Without a `skeleton` the gate renders
 * nothing during this window, which reads as a permission denial and makes the
 * section flash in once the store settles.
 */
export const Loading: Story = {
  name: 'Loading (skeleton)',
  args: {
    skeleton: <PanelSkeleton />,
  },
  beforeEach: withMembership(RECEPTIONIST, 'loading'),
};
