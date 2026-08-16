import type { Meta, StoryObj } from '@storybook/react';
import type { Organisation } from '@yosemite-crew/types';

import PhoneHeader from './PhoneHeader';
import { useOrgStore } from '@/app/stores/orgStore';

// PhoneHeader is styled by the shell's stylesheet, which the app loads through
// PhoneShell rather than the header itself.
import './PhoneShell.css';

const ORG_ID = 'org-storybook';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
};

/**
 * Seeds the org store the way the app's bootstrap does, and puts it back
 * afterwards so neighbouring stories are unaffected.
 */
const withOrg = (org: Organisation | null) => () => {
  const snapshot = useOrgStore.getState();

  useOrgStore.setState(
    org
      ? { orgsById: { [ORG_ID]: org }, orgIds: [ORG_ID], primaryOrgId: ORG_ID, status: 'loaded' }
      : { orgsById: {}, orgIds: [], primaryOrgId: null, status: 'loaded' }
  );

  return () => {
    useOrgStore.setState(snapshot);
  };
};

const PHONE_VIEWPORT = {
  phone: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

const meta = {
  title: 'Layout/PhoneHeader',
  component: PhoneHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    // Every rule in PhoneShell.css sits inside a `max-width: 767px` media
    // query, so both the canvas and the Chromatic snapshot have to be phone
    // width or the header renders as bare, unstyled elements.
    viewport: { options: PHONE_VIEWPORT },
    chromatic: { viewports: [375] },
    // The org chip pushes a route on tap, so the App Router mock has to be on.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The fixed 54px header on phones (< 768px), which replaces the desktop user header. It ' +
          'holds the organisation switcher on the left and the search and notifications controls on ' +
          'the right, over a blurred `--glass-93` band with a `--hairline` bottom edge. It reads the ' +
          'primary organisation straight from the org store; these stories seed that store rather ' +
          'than calling the API. `Layout/PhoneShell` shows the same header in place with the tab bar ' +
          'and FAB around it.',
      },
    },
  },
} satisfies Meta<typeof PhoneHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The normal signed-in header: org avatar, short name, caret, search, bell. */
export const WithOrganisation: Story = {
  name: 'With organisation',
  beforeEach: withOrg(ORG),
};

/**
 * A long organisation name. The chip is capped at 62vw and ellipsises, so the
 * name can never push the search and bell buttons off the right edge.
 */
export const LongOrganisationName: Story = {
  name: 'Long organisation name',
  beforeEach: withOrg({
    ...ORG,
    name: 'Sunrise Veterinary Hospital and Emergency Referral Centre',
  }),
};

/**
 * No primary organisation yet — before bootstrap resolves, or for an account
 * that belongs to none. The switcher is replaced by the brand mark rather than
 * an empty chip.
 */
export const NoOrganisation: Story = {
  name: 'No organisation (brand mark)',
  beforeEach: withOrg(null),
};
