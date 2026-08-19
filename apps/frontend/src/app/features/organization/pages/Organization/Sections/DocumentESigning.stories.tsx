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

const SWITCHES = [
  'Sign in the pet parent app',
  'Sign on clinic tablet',
  'Require signature before surgery check-in',
] as const;

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
          'The e-signing preferences card. The card itself was reachable; the **portal ' +
          'expander at the bottom of it was not**, and it is the only thing on this card that ' +
          'changes the page rather than a colour.\n\n' +
          'Worth separating the two kinds of control here, because they look alike and behave ' +
          'nothing alike. The three switches are local `useState` toggles that repaint a track ' +
          'and slide a knob - they gate nothing, reveal nothing, and the Save pill beside them ' +
          'only raises a toast. The last row is the real branch: it flips `showPortal`, swaps ' +
          'its own label between "Manage document signing portal" and "Hide", and mounts ' +
          '`<DocSigningPortal embedded />` into a region that does not exist while collapsed.\n\n' +
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

    /* Two of three start on. The default matters: this card ships opinionated -
       both signing channels enabled, the surgery block off - so a reviewer sees
       the shipped configuration rather than a blank form. */
    await expect(canvas.getByRole('switch', { name: SWITCHES[0] })).toBeChecked();
    await expect(canvas.getByRole('switch', { name: SWITCHES[1] })).toBeChecked();
    await expect(canvas.getByRole('switch', { name: SWITCHES[2] })).not.toBeChecked();

    await expect(canvas.getByText("Send documents to the parent's phone")).toBeInTheDocument();
    await expect(canvas.getByText('Blocks check-in until consent is signed')).toBeInTheDocument();
    await expect(canvas.getByText('Changes apply org-wide')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();

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
          'The resting card. The blue shield note between the switches and the footer is copy, ' +
          'not a control - it explains what sealing a signed document means, and it is the only ' +
          'inset panel on the organisation page.',
      },
    },
  },
};

export const SwitchToggled: Story = {
  name: 'Switch toggled (a colour, not a gate)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surgery = canvas.getByRole('switch', { name: SWITCHES[2] });
    const before = getComputedStyle(surgery).backgroundColor;

    await userEvent.click(surgery);

    await expect(surgery).toBeChecked();
    /* Polled, not read once: the track carries `transition-colors`, so a single
       synchronous read catches an interpolated value halfway between --inset and
       --blue and compares two mid-transition colours. */
    await waitFor(() => {
      expect(getComputedStyle(surgery).backgroundColor).not.toBe(before);
    });
    // It is a local toggle: nothing else on the card moved.
    const expander = canvas.getByRole('button', { name: 'Manage document signing portal' });
    await expect(expander).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByRole('switch', { name: SWITCHES[0] })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Proof that the three switches are presentation only. `aria-checked` moves, the track ' +
          'repaints from `--inset` to `--blue` and the knob translates 18px, and nothing else on ' +
          'the card changes - no section appears, no request is made, and Save is the only thing ' +
          'that would persist any of it.',
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
