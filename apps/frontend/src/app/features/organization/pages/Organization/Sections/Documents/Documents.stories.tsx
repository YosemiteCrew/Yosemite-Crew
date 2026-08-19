import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { OrganizationDocument } from '@/app/features/documents/types/document';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import Documents from './Documents';

const ORG_ID = 'org-storybook-documents-section';

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

/** RECEPTIONIST holds `document:view:any` but not `document:edit:any`. */
const RECEPTIONIST: UserOrganization = {
  ...OWNER,
  id: 'membership-reception',
  roleCode: 'RECEPTIONIST',
};

/**
 * One document per `getDocTypeBadge` branch, in the order the function tests
 * them: no file at all, `.pdf`, `.docx`, and an extension it does not know.
 */
const DOCUMENTS: OrganizationDocument[] = [
  {
    _id: 'doc-cancellation',
    organisationId: ORG_ID,
    title: 'Cancellation policy',
    description: 'Merge fields: parent, visit, practitioner.',
    category: 'CANCELLATION_POLICY',
    fileUrl: '',
  },
  {
    _id: 'doc-anaesthesia',
    organisationId: ORG_ID,
    title: 'Consent to anaesthesia',
    description: 'Signed before any procedure under GA.',
    category: 'GENERAL',
    fileUrl: 'https://files.example.com/sunrise-vet/consent-to-anaesthesia.pdf',
  },
  {
    _id: 'doc-boarding',
    organisationId: ORG_ID,
    title: 'Boarding terms',
    category: 'TERMS_AND_CONDITIONS',
    fileUrl: 'https://files.example.com/sunrise-vet/boarding-terms.docx',
  },
  {
    _id: 'doc-fire',
    organisationId: ORG_ID,
    title: 'Fire evacuation plan',
    description: 'Posted at both exits.',
    category: 'FIRE_SAFETY',
    fileUrl: 'https://files.example.com/sunrise-vet/fire-plan.png',
  },
];

/**
 * Seeds the real stores rather than mocking the hooks.
 * `useDocumentsForPrimaryOrg` is a pure store selector - the fetch lives in the
 * separate `useLoadDocumentsForPrimaryOrg`, which this section does not call -
 * so the list mounts with no network. `status: 'loaded'` is required or
 * `usePermissions` reports `isLoading` and the gate renders its null skeleton.
 */
const seed =
  ({
    membership = OWNER,
    documents = DOCUMENTS,
  }: { membership?: UserOrganization; documents?: OrganizationDocument[] } = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useOrganizationDocumentStore.getState().setDocumentsForOrg(ORG_ID, documents);

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
      });
      useOrganizationDocumentStore.setState({ documentsById: {}, documentIdsByOrgId: {} });
    };
  };

/**
 * Both drawers portal to `document.body` and both stay mounted once rendered -
 * only the `open` attribute moves - so presence is counted on `dialog[open]`.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];

const meta = {
  title: 'Organization/Documents',
  component: Documents,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The clinic-wide documents list. Only the populated list was ever reachable in ' +
          'Storybook - the empty branch needs an org with no documents, the `Add` pill needs ' +
          '`document:edit:any`, and the detail drawer only exists after a click.\n\n' +
          'The row badge is the part worth reviewing, because it is derived from the FILE URL ' +
          'rather than from a stored type. `getDocTypeBadge` lowercases the url and branches on ' +
          'it: an empty url is the in-app e-sign template and gets the green E-SIGN pill with ' +
          'the pencil glyph, `.pdf` and `.doc`/`.docx` get their own labels, and anything else ' +
          'falls back to FILE. All three uploaded labels share ONE colour, so the split a ' +
          'reviewer should see is green-versus-blue, not four colours.\n\n' +
          'The subline is a second derivation of the same record - `toTitle(category)` plus the ' +
          'description behind a `·` - and a document with no description loses the separator ' +
          'along with it rather than rendering a trailing dot.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[520px] w-[900px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof Documents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DocumentList: Story = {
  name: 'Documents list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Clinic-wide templates and files')).toBeInTheDocument();

    /* Assert the whole row button. Title and subline are two independent
       derivations of one record, and checking them apart passes with the
       category of one document rendered under the title of another. */
    await expect(canvas.getByRole('button', { name: 'View Cancellation policy' }).textContent).toBe(
      'Cancellation policyCancellation policy · Merge fields: parent, visit, practitioner.'
    );
    // No description: the ` · ` separator goes with it, not just the text.
    await expect(canvas.getByRole('button', { name: 'View Boarding terms' }).textContent).toBe(
      'Boarding termsTerms and conditions'
    );

    // One badge per branch, in the order getDocTypeBadge tests them.
    await expect(canvas.getByText('E-SIGN')).toBeInTheDocument();
    await expect(canvas.getByText('PDF')).toBeInTheDocument();
    await expect(canvas.getByText('DOC')).toBeInTheDocument();
    await expect(canvas.getByText('FILE')).toBeInTheDocument();

    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(4);
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Templates support merge fields: patient, parent, visit, practitioner')
    ).toBeInTheDocument();
    await expect(openDialogs()).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list. Each row carries two routes into the same drawer - the row body ' +
          'and the trailing kebab - wired to the same handler, so the kebab is a visual ' +
          'affordance for a target that already spans the row.',
      },
    },
  },
};

export const BadgeColours: Story = {
  name: 'E-SIGN vs uploaded badge colours',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const esign = canvas.getByText('E-SIGN');
    const pdf = canvas.getByText('PDF');
    const doc = canvas.getByText('DOC');
    const file = canvas.getByText('FILE');

    /* Polled rather than read once: these pills resolve their colour from CSS
       variables through an inline style, and a single synchronous read can land
       before the token layer has settled. */
    await waitFor(() => {
      expect(getComputedStyle(esign).color).not.toBe(getComputedStyle(pdf).color);
    });
    // The three uploaded kinds are ONE colour with three labels, not three tones.
    await waitFor(() => {
      const pdfColor = getComputedStyle(pdf).color;
      expect(getComputedStyle(doc).color).toBe(pdfColor);
      expect(getComputedStyle(file).color).toBe(pdfColor);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The colour split is the whole point of the badge: green means "there is nothing to ' +
          'download, this gets signed in the app", blue means "there is a file behind this ' +
          'row". The label alone does not carry that - PDF, DOC and FILE are three names for ' +
          'the same state.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No documents yet',
  beforeEach: seed({ documents: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('No documents yet. Add clinic-wide templates and files.')
    ).toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
    /* The two grey strips above and below the rows are not part of the list, so
       they survive the empty branch - the sentence lands between them. */
    await expect(canvas.getByText('Clinic-wide templates and files')).toBeInTheDocument();
    await expect(
      canvas.getByText('Templates support merge fields: patient, parent, visit, practitioner')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A loaded org with nothing filed. `activeDocument` is `null` here, which is what ' +
          'keeps the detail drawer from mounting at all - so this state has one fewer dialog in ' +
          'the DOM than the populated one, not merely a closed one.',
      },
    },
  },
};

export const AddDocumentDrawer: Story = {
  name: 'Add opens the AddDocument drawer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialogs()).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    await expect(panel.getByRole('heading', { name: 'Add document' })).toBeVisible();
    /* The drawer opens EMPTY. Asserted on the field VALUES rather than on the
       presence of the fields: `AddDocument` and `DocumentInfo` are two panels
       over the same record shape, and the failure worth catching is the add
       drawer opening pre-filled from whichever row the list had selected. */
    await expect(panel.getByLabelText('Document title')).toHaveValue('');
    await expect(panel.getByLabelText('Description')).toHaveValue('');
    // Empty is not the same as unset: category opens on a real default.
    await expect(panel.getByText('Cancellation policy')).toBeInTheDocument();

    /* The drop zone and its hidden `<input type="file">` share one `aria-label`,
       so this is a role query - a label query would match both and throw. */
    await expect(panel.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The add drawer requires both a name and a file before it will save, so a document ' +
          'created here can never be the E-SIGN template shape above - that row is only ' +
          'reachable by clearing the file later.',
      },
    },
  },
};

export const RowOpensDetail: Story = {
  name: 'Row opens the document drawer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Fire evacuation plan' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    const title = panel.getByRole('heading', { name: 'Fire evacuation plan' });
    /* Eyebrow / title / meta as one string. `activeDocument` starts life pointing
       at the FIRST document, so asserting only that a drawer opened passes with
       the cancellation policy in it. */
    await expect((title.parentElement?.parentElement as HTMLElement).textContent).toBe(
      'DocumentFire evacuation planFire safety'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The kebab and the row body call the same handler, which sets the selection and opens ' +
          'the drawer together. The fourth row is used here on purpose: a drawer that shows the ' +
          'first document instead is the failure this catches.',
      },
    },
  },
};

export const WithoutEditPermission: Story = {
  name: 'Add hidden: receptionist',
  beforeEach: seed({ membership: RECEPTIONIST }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    // document:view:any survives, so the list and both routes into it remain.
    await expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(4);
    await expect(canvas.getByRole('button', { name: 'View Boarding terms' }).textContent).toBe(
      'Boarding termsTerms and conditions'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same flag travels into the drawer as `canEditDocument`, where it also removes the ' +
          'replacement uploader and both accordion icons - so this is a read-only section, not ' +
          'only a missing header pill.',
      },
    },
  },
};
