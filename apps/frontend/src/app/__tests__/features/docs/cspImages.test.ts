import { loadCorpus } from '@/app/features/docs/corpus';
import { renderDoc } from '@/app/features/docs/render';

/*
 * Every image the docs render must be reachable under the app's own CSP.
 *
 * This is not theoretical. The Docusaurus site got away with remote badge
 * images only because `/dev-docs` was served by CloudFront OUTSIDE Next, with
 * no CSP header at all. Rendering the same markdown through the app applies
 * `img-src`, and a blocked image fails SILENTLY - no console error the reader
 * sees, just a missing picture.
 *
 * The hosts below mirror securityHeaders.ts. If that allowlist changes, this
 * list has to change with it - which is the point: a contributor adding a
 * remote image to a docs page should fail here rather than ship an image that
 * never loads.
 */
const CSP_IMG_ALLOWED = [
  'd2il6osz49gpup.cloudfront.net',
  'd2kyjiikho62xx.cloudfront.net',
  'images.unsplash.com',
  'plus.unsplash.com',
  'yosemitecrew-backend.s3.eu-central-1.amazonaws.com',
  'cdn.yc.dev',
  'laika.aitemsolutions.com',
  'upload.wikimedia.org',
  'stripe.com',
];

const isAllowed = (host: string) =>
  CSP_IMG_ALLOWED.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));

describe('docs images under the app CSP', () => {
  const corpus = loadCorpus();

  it('renders no image from a host img-src would block', async () => {
    const blocked: string[] = [];

    for (const entry of corpus) {
      const { html } = await renderDoc(entry, corpus);
      for (const match of html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/g)) {
        const { host } = new URL(match[1]);
        if (!isAllowed(host)) blocked.push(`${entry.file} → ${host}`);
      }
    }

    expect(blocked).toEqual([]);
  });

  /*
   * Live-data images are a separate problem from CSP, and vendoring them
   * locally would be the wrong fix: a frozen coverage badge or star-history
   * chart asserts a number that has stopped being true. Those were converted
   * to links instead, so none should come back as images.
   */
  it('embeds no live-data image, which would freeze a number into a claim', async () => {
    const liveDataHosts = ['sonarcloud.io', 'api.star-history.com', 'img.shields.io'];
    const found: string[] = [];

    for (const entry of corpus) {
      const { html } = await renderDoc(entry, corpus);
      for (const match of html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/g)) {
        const { host } = new URL(match[1]);
        if (liveDataHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
          found.push(`${entry.file} → ${host}`);
        }
      }
    }

    expect(found).toEqual([]);
  });
});
