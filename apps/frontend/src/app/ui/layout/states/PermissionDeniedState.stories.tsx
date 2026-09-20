import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import PermissionDeniedState from './PermissionDeniedState';

const ORG_ID = 'org-meadowbrook';

const RECEPTIONIST: UserOrganization = {
  id: 'membership-reception',
  practitionerReference: 'Practitioner/reception-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
};

/**
 * Seeds the org store with one membership so the stories that leave `role`
 * unset can show the role being resolved from the store rather than typed in.
 * The store is persisted, so the previous values go back on unmount.
 */
const withMembership = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: RECEPTIONIST },
  });
  return () => {
    useOrgStore.setState({
      primaryOrgId: snapshot.primaryOrgId,
      membershipsByOrgId: snapshot.membershipsByOrgId,
    });
  };
};

const meta = {
  title: 'Layout/PermissionDeniedState',
  component: PermissionDeniedState,
  parameters: {
    layout: 'fullscreen',
    // `useRouter` is called at render for the default request-access and back
    // actions, so the App Router mock has to be mounted even when handlers are passed.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'What a signed-in person sees when their role cannot open a route or a panel. It is an ' +
          'expected state, not a failure, so it uses the warn tokens rather than the error ones ' +
          'and names three concrete things: the resource, the role that lacks it, and who can ' +
          'change that (an owner or manager, in Organization > Team).\n\n' +
          "The role is resolved in order: the `role` prop, then the membership's `roleDisplay`, " +
          'then its `roleCode`, then the phrase "your current role" when no membership is in the ' +
          'store. Two variants share that logic: `page` is the centred card for a whole route, ' +
          '`inline` is a one-line `<output>` notice for a section inside an otherwise readable ' +
          'page. Without handlers, "Request access" pushes `/organization` and "Back" calls ' +
          '`router.back()`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onRequestAccess: fn(),
    onBack: fn(),
  },
  beforeEach: withMembership,
} satisfies Meta<typeof PermissionDeniedState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {
  name: 'Page variant',
  args: {
    resource: 'Finance',
    detail: 'invoices and payouts',
    role: 'Vet technician',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("You don't have access to Finance")).toBeInTheDocument();
    await expect(
      canvas.getByText(/Your role \(Vet technician\) can't view invoices and payouts\./)
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Request access' }));
    await expect(args.onRequestAccess).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await expect(args.onBack).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The route-level card, reached through `PermissionGate` with a `deniedResource`. Every ' +
          'noun on it comes from props, so a vet technician locked out of Finance reads a sentence ' +
          'about invoices and payouts rather than a generic "not authorised".',
      },
    },
  },
};

export const RoleFromMembership: Story = {
  name: 'Role resolved from the membership',
  args: {
    resource: 'the team roster',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("You don't have access to the team roster")).toBeInTheDocument();
    // No `role` prop: the display name comes off the primary org's membership.
    await expect(
      canvas.getByText(/Your role \(Receptionist\) can't view the team roster\./)
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "No `role` and no `detail`: the role is read from the primary organisation's membership " +
          'in the org store, and the detail falls back to the resource. This is the reading most ' +
          'gates produce, since they rarely know the role themselves.',
      },
    },
  },
};

export const NoMembership: Story = {
  name: 'No membership in the store',
  args: {
    resource: 'practice analytics',
    orgId: 'org-not-loaded',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/Your role \(your current role\) can't view practice analytics\./)
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An org whose membership has not been loaded. The sentence degrades to "your current ' +
          'role" rather than printing `undefined` or hiding the explanation.',
      },
    },
  },
};

export const Inline: Story = {
  name: 'Inline variant',
  args: {
    variant: 'inline',
    resource: 'billing and subscription',
    role: 'Receptionist',
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 560, padding: 24 }}>
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // `<output>` carries an implicit status role, which is how assistive tech
    // finds the notice without a heading.
    const notice = canvas.getByRole('status');
    await expect(notice).toHaveTextContent(
      "Your role (Receptionist) can't view billing and subscription."
    );
    await userEvent.click(within(notice).getByRole('button', { name: 'Request access' }));
    await expect(args.onRequestAccess).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The compact notice `Fallback` renders inside a section. One line, a lock glyph, and the ' +
          'request-access link inline; no back action, because the page around it is still usable.',
      },
    },
  },
};

export const DefaultNavigation: Story = {
  name: 'Default actions (router)',
  args: {
    resource: 'Finance',
    detail: 'invoices and payouts',
    role: 'Vet technician',
    onRequestAccess: undefined,
    onBack: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Request access' }));
    await expect(getRouter().push).toHaveBeenCalledWith('/organization');
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await expect(getRouter().back).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without handlers the card drives the App Router itself: request access goes to the ' +
          'organisation page where an owner can change the role, and back is a history pop.',
      },
    },
  },
};
