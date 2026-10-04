import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import DocumentESigning from './DocumentESigning';

const ORG_ID = 'org-storybook-esigning';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/**
 * Seeds the org store rather than mocking the permission hook. `status:
 * 'loaded'` is load-bearing - `usePermissions` reports `isLoading` while the
 * store is `idle`, and the gate renders its null skeleton, so the whole section
 * would be blank rather than denied.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
    });
  };
};

/**
 * Which branch of `DocSigningPortal` is on screen, or `null` while it is still
 * resolving. Identified by ROLE rather than by copy: the error branch prints
 * whatever the transport threw ("Network Error", "Request failed with status
 * code 404"), so its text is not something a story can pin.
 *
 * Hoisted above the `waitFor` that uses it on purpose - it only reads the DOM.
 * A probe that mutated and then threw would re-queue through testing-library's
 * MutationObserver forever and wedge the tab instead of failing.
 */
const portalBranch = (region: HTMLElement): 'iframe' | 'error' | 'no-url' | 'loading' | null => {
  if (region.querySelector('iframe')) return 'iframe';
  if (region.querySelector('[role="alert"]')) return 'error';
  if (region.querySelector('h1')) return 'no-url';
  if (region.textContent?.includes('Loading Doc Signing')) return 'loading';
  return null;
};

const meta = {
  title: 'Organization/DocumentESigning',
  component: DocumentESigning,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The e-signing card: a line of copy, the sealing note and the **portal expander**, ' +
          'which is the only control on it.\n\n' +
          'The card used to carry three channel switches and a Save pill. They were local ' +
          '`useState` literals that nothing loaded or persisted - every clinic saw the same ' +
          'invented configuration and Save only raised a toast - so they were removed rather ' +
          'than left asserting settings nothing records. What remains is the real branch: the ' +
          'expander flips `showPortal`, swaps its own label between "Manage document signing ' +
          'portal" and "Hide", and mounts `<DocSigningPortal embedded />` into a region that ' +
          'does not exist while collapsed.\n\n' +
          'Storybook has no Documenso backend and no session, so the mounted portal cannot ' +
          'reach its redirect endpoint. What is drawn below is therefore the expander contract ' +
          'and the portal in whichever offline state it settles into - the reveal, the label ' +
          'swap and the `aria-expanded` flag are the parts under review, not the iframe.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-[760px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof DocumentESigning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'E-signing card',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: 'E-signing' })).toBeInTheDocument();
    await expect(canvas.getByText('How consent documents get signed')).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'Signed documents are sealed with a timestamp and signer identity, stored in the medical record.'
      )
    ).toBeInTheDocument();

    /* No channel switches and no Save: nothing persisted them, so the card no
       longer offers settings that would silently revert. The expander is the
       only control left on it. */
    await expect(canvas.queryAllByRole('switch')).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Changes apply org-wide')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('button')).toHaveLength(1);

    // The expander, collapsed. The region it controls does not exist yet -
    // it is not hidden, there is no node.
    const expander = canvas.getByRole('button', { name: 'Manage document signing portal' });
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(expander.nextElementSibling).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting card. The blue shield note above the expander is copy, not a control - ' +
          'it explains what sealing a signed document means, and it is the only inset panel on ' +
          'the organisation page.',
      },
    },
  },
};

export const PortalExpanded: Story = {
  name: 'Portal expander revealed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const expander = canvas.getByRole('button', { name: 'Manage document signing portal' });

    await userEvent.click(expander);

    // The button relabels itself rather than pairing with a separate close.
    await expect(expander).toHaveAttribute('aria-expanded', 'true');
    await expect(expander).toHaveAccessibleName('Hide document signing portal');

    /* The region is the expander's next sibling - it is created by the reveal,
       so its mere existence is the state change. Its CONTENT is the portal,
       which needs an authenticated Documenso redirect Storybook cannot serve,
       so the branch it settles in is read rather than asserted to be one
       specific value. */
    const region = expander.nextElementSibling as HTMLElement;
    await expect(region).not.toBeNull();
    await waitFor(() => {
      expect(portalBranch(region)).not.toBeNull();
    });
    await expect(['iframe', 'error', 'no-url', 'loading']).toContain(portalBranch(region));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. `showPortal` is the only piece of state on this card that mounts ' +
          'a component, and the component it mounts is the full signing portal in its `embedded` ' +
          'form - `h-[75vh] min-h-[560px]` rather than the standalone route’s ' +
          '`h-[calc(100vh-140px)]`, which is the only difference between the two and only ' +
          'visible from inside this card.',
      },
    },
  },
};
