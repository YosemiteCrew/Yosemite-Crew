import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, waitFor, within } from 'storybook/test';
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';

import RecordAttestationModal from './RecordAttestationModal';
import type { PassportRecordStatus } from './attestationModel';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  CompanionRecord,
  SignedFile,
} from '@/app/features/documents/types/companionDocuments';

const ORG_ID = 'org-storybook';

const RECORD: CompanionRecord = {
  id: 'doc-rabies-2026',
  title: 'Rabies vaccination certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  issueDate: '2026-01-04',
  issuingBusinessName: 'Harbourside Veterinary Group',
  uploadedByParentId: 'parent-42',
  attachments: [{ key: 'rabies-cert.png', mimeType: 'image/png' }],
};

/**
 * A stand-in for a photographed certificate, inlined as a data URI so the panel
 * has a real file to preview without a network round trip. The colours in it are
 * the content of a scan - paper and print - not UI chrome.
 */
const SCAN_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="452">',
  '<rect width="640" height="452" fill="#fbfaf7"/>',
  '<rect x="28" y="28" width="584" height="396" fill="#ffffff" stroke="#d9d3c8"/>',
  '<text x="60" y="96" font-family="Georgia, serif" font-size="26" fill="#2b2a28">',
  'Rabies Vaccination Certificate</text>',
  '<rect x="60" y="126" width="300" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="156" width="470" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="186" width="420" height="10" fill="#e6e1d8"/>',
  '<rect x="60" y="216" width="360" height="10" fill="#e6e1d8"/>',
  '<text x="60" y="366" font-family="Georgia, serif" font-size="20" fill="#4a4640">',
  'Signed: A. Osei MRCVS</text>',
  '</svg>',
].join('');

const DOCUMENT_FILES: SignedFile[] = [
  {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(SCAN_SVG)}`,
    mimeType: 'image/png',
    key: 'rabies-cert.png',
  },
];

const ok = <T,>(config: InternalAxiosRequestConfig, data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });

const fail = (
  config: InternalAxiosRequestConfig,
  status: number,
  message: string
): Promise<AxiosResponse> =>
  Promise.reject(
    new AxiosError(message, String(status), config, undefined, {
      data: { message },
      status,
      statusText: message,
      headers: {},
      config,
    })
  );

/** A request that never settles - which is what "still in flight" actually is. */
const neverSettles = (): Promise<AxiosResponse> => new Promise<AxiosResponse>(() => {});

type Handlers = {
  /** Answer for `POST /records/:id/sign`. Defaults to an accepted request. */
  onSign?: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  /** Answer for the document preview fetch. Defaults to the scan above. */
  onDocument?: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
};

/**
 * One canned API for the whole panel: the document preview it fetches on open,
 * and the three attestation calls. Stories override only the leg they are about,
 * so no story can reach the network however far its interactions drive it.
 */
const buildAdapter = ({ onSign, onDocument }: Handlers = {}): AxiosAdapter => {
  return (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    if (url.includes('/document/pms/view/')) {
      return (onDocument ?? ((request) => ok(request, DOCUMENT_FILES)))(config);
    }
    if (url.endsWith('/sign')) {
      return (
        onSign ??
        ((request: InternalAxiosRequestConfig) =>
          ok(request, {
            artifactId: 'artifact-8801',
            status: 'IN_PROGRESS',
            documensoDocumentId: 'documenso-551',
          }))
      )(config);
    }
    if (url.endsWith('/attest')) {
      return ok(config, {
        artifactId: 'artifact-8801',
        status: 'SIGNED',
        signedAt: '2026-02-14T09:12:00.000Z',
      });
    }
    if (url.endsWith('/revoke')) {
      return ok(config, { artifactId: 'artifact-8801', status: 'VOID' });
    }
    return fail(config, 404, `No canned response for ${url}`);
  };
};

const VETERINARIAN: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

/**
 * The attestation routes are scoped to the active organisation, so the store is
 * seeded the way bootstrap does it - without an org id the service throws before
 * it ever builds a request. The API adapter is swapped here too and both are put
 * back when the story unmounts; `clearInFlightGetRequests` is part of that
 * teardown because a story whose fetch never settles would otherwise leave its
 * promise in the GET dedupe cache for the next story to await forever.
 */
const withApi = (handlers: Handlers = {}) => {
  return () => {
    const snapshot = useOrgStore.getState();
    const previousAdapter = api.defaults.adapter;

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: VETERINARIAN },
      status: 'loaded',
    });
    api.defaults.adapter = buildAdapter(handlers);

    return () => {
      useOrgStore.setState(snapshot);
      api.defaults.adapter = previousAdapter;
      clearInFlightGetRequests();
    };
  };
};

/** The panel portals to `document.body`, so queries start there, not at the canvas. */
const panel = () => within(document.body);

const tickDeclaration = async () => {
  const checkbox = await panel().findByRole<HTMLInputElement>('checkbox');
  await userEvent.click(checkbox);
  await waitFor(() => {
    if (!checkbox.checked) throw new Error('The declaration has not been ticked yet.');
  });
};

/**
 * The attestation actions are disabled until the declaration is ticked, and a
 * click on a disabled button is simply swallowed - so each story waits for the
 * button it is about to press to become live rather than racing the re-render.
 */
const pressAction = async (name: string) => {
  const button = await panel().findByRole<HTMLButtonElement>('button', { name });
  await waitFor(() => {
    if (button.disabled) throw new Error(`"${name}" is still disabled.`);
  });
  await userEvent.click(button);
};

const link = (status: PassportRecordStatus) => ({ recordId: 'artifact-8801', status });

const meta = {
  title: 'Pet Passport/Attestation/RecordAttestationModal',
  component: RecordAttestationModal,
  parameters: {
    // No `autodocs`: the panel portals to document.body over a fixed, blurred
    // backdrop, so on a docs page every story would stack on top of the page
    // instead of rendering in its own block.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Review-and-attest for a pet-parent upload that has been captured as a passport clinical ' +
          'record: the file and the parsed record side by side, a declaration the veterinarian must ' +
          'tick, then either the preferred Documenso e-signature or the manual fallback. A signed ' +
          'record can be revoked from the same panel, behind a second screen of its own. Every story ' +
          'stubs the API client, so nothing here reaches the network.',
      },
    },
  },
  args: {
    open: true,
    companionId: 'companion-storybook',
    record: RECORD,
    link: link('DRAFT'),
    onClose: fn(),
    onStatusChange: fn(),
  },
  beforeEach: withApi(),
} satisfies Meta<typeof RecordAttestationModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the panel opens on an unattested record: the scan on the left, the parsed
 * record on the right, the review hint above the declaration, and both actions
 * inert until the declaration is ticked.
 */
export const Draft: Story = {
  name: 'Draft - opened for review',
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
  },
};

/**
 * The declaration is ticked, so e-signature leads and manual attestation reads
 * as the alternative.
 */
export const ReadyToAttest: Story = {
  name: 'Draft - declaration ticked',
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await tickDeclaration();
  },
};

/**
 * The practice has no Documenso key. The service answers the sign request with
 * 400 "Documenso signing is not configured...", which is the one failure that
 * promotes manual attestation instead of asking the vet to try again: the notice
 * appears and manual attestation takes the primary slot.
 */
export const ManualFallback: Story = {
  name: 'No Documenso configured - manual fallback',
  beforeEach: withApi({
    onSign: (config) =>
      fail(config, 400, 'Documenso signing is not configured for this practice or signer.'),
  }),
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await tickDeclaration();
    await pressAction('Send for signature');
    await panel().findByText(/Documenso e-signature is not set up for this practice/);
  },
};

/**
 * The signature request is in flight: the primary reads "Sending...", every
 * action and the close control are disabled, and the panel cannot be dismissed
 * by Escape or a backdrop click while the request is out.
 */
export const SendingSignature: Story = {
  name: 'Busy - sending for signature',
  beforeEach: withApi({ onSign: neverSettles }),
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await tickDeclaration();
    await pressAction('Send for signature');
    await panel().findByRole('button', { name: 'Sending...' });
  },
};

/**
 * The request failed for a reason that is not "no Documenso". The API's own
 * message is shown rather than a generic apology, and the record keeps its
 * status - nothing was signed.
 */
export const SignatureRequestFailed: Story = {
  name: 'Error - signature request rejected',
  beforeEach: withApi({
    onSign: (config) => fail(config, 500, 'The signing service did not respond. Try again.'),
  }),
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await tickDeclaration();
    await pressAction('Send for signature');
    await panel().findByRole('alert');
  },
};

/**
 * A record that has been sent for e-signature. It deliberately does not read as
 * signed: it only counts once Documenso's webhook reports the signature back, so
 * the vet can still attest it by hand from here.
 */
export const SignaturePending: Story = {
  name: 'Signature pending',
  args: { link: link('IN_PROGRESS') },
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
  },
};

/**
 * The end of the manual route, driven through the real handler: tick, attest,
 * and the panel re-reads as an attested record - pill, sentence and the single
 * remaining revoke action all flip together.
 */
export const AttestedManually: Story = {
  name: 'Attested manually',
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await tickDeclaration();
    await pressAction('Attest manually instead');
    await panel().findByRole('button', { name: 'Revoke attestation' });
  },
};

/**
 * An already-attested record. The declaration is gone - there is nothing left to
 * confirm - and the only action is the danger secondary that starts a revocation.
 */
export const Attested: Story = {
  name: 'Attested record',
  args: { link: link('SIGNED') },
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
  },
};

/**
 * The second screen of a revocation. Revoking pulls a record a border officer may
 * already have relied on back out of the passport, so it gets its own panel and
 * its own confirm rather than sitting one click away in the review footer.
 */
export const RevokeConfirmation: Story = {
  name: 'Revoke - confirmation step',
  args: { link: link('SIGNED') },
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
    await pressAction('Revoke attestation');
    await panel().findByLabelText('Reason (optional, stored with the record)');
  },
};

/**
 * A revoked record: terminal. No declaration, no attestation actions, and the
 * record panel states plainly that it no longer counts toward the passport.
 */
export const Revoked: Story = {
  name: 'Revoked record',
  args: { link: link('VOID') },
  play: async () => {
    await panel().findByAltText('Uploaded document: Rabies vaccination certificate');
  },
};

/**
 * The document itself could not be fetched. The review hint and the declaration
 * still render - the record may be attestable - but the panel says plainly not to
 * attest something you cannot read.
 */
export const DocumentUnreadable: Story = {
  name: 'Error - document could not be loaded',
  beforeEach: withApi({
    onDocument: (config) => fail(config, 403, 'The signed URL has expired.'),
  }),
  play: async () => {
    await panel().findByText(/This file could not be loaded/);
  },
};
