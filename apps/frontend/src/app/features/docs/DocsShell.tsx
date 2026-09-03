import Link from 'next/link';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { Root } from 'hast';
import type { NavNode } from './docsNav';
import type { TocEntry } from './render';
import DocsSidebar from './DocsSidebar';
import DocsSearch from './DocsSearch';
import './docs.css';

interface DocsShellProps {
  nav: NavNode[];
  toc: TocEntry[];
  title: string;
  breadcrumb: string[];
  /**
   * Sanitised HAST from render.ts, rendered as React elements.
   *
   * Deliberately a tree rather than an HTML string: the feature has no raw
   * HTML sink at all, so the sanitiser and React's own text escaping both have
   * to fail before contributed markup could execute.
   *
   * That claim is enforced by DocsShell.test.tsx, which pushes six injection
   * attempts through the real render pipeline into a mounted DOM. Stating it
   * here is documentation; the tests are what keep it true. (The comment used
   * to name the React API it was ruling out, which read as an occurrence of it
   * to the security scanners - a sentence cannot be a control.)
   */
  tree: Root;
  /**
   * Renders the Redoc viewer under the body. Set only by the page for the
   * OpenAPI reference.
   */
  embedOpenApi?: boolean;
  editUrl: string;
}

/**
 * Chrome for the public documentation.
 *
 * `data-yc-app` is not decoration. globals.css scopes a set of faint-ink
 * overrides to `body:has([data-yc-app])`, including
 * `--color-text-tertiary: #66635f`. Off that scope the token falls back to
 * #8f8984, which measures below 4.5:1 on the bone surfaces and would render
 * the sidebar headings, breadcrumb and search placeholder at failing contrast
 * in light mode only - the sort of regression that looks like a shade
 * difference rather than a bug. `display: contents` means the wrapper adds no
 * box, exactly as (app)/layout.tsx does it.
 */
export default function DocsShell({
  nav,
  toc,
  title,
  breadcrumb,
  tree,
  editUrl,
  embedOpenApi = false,
}: Readonly<DocsShellProps>) {
  return (
    <div data-yc-app style={{ display: 'contents' }}>
      <div className="DocsPage">
        <header className="DocsTopBar">
          <Link href="/developers" className="DocsTopBrand">
            Yosemite Crew
          </Link>
          <span className="DocsTopDivider" aria-hidden="true" />
          <Link href="/docs" className="DocsTopTitle">
            Developer Docs
          </Link>
          <div className="DocsTopSpacer" />
          <DocsSearch />
        </header>

        <div className="DocsLayout">
          <DocsSidebar nav={nav} />

          <main className="DocsMain" id="docs-content">
            <nav className="DocsBreadcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((crumb, index) => (
                <span key={crumb}>
                  {index > 0 && (
                    <span className="DocsBreadcrumbSep" aria-hidden="true">
                      /
                    </span>
                  )}
                  {crumb}
                </span>
              ))}
            </nav>

            <h1 className="DocsTitle">{title}</h1>

            <article className="DocsBody">{toJsxRuntime(tree, { Fragment, jsx, jsxs })}</article>

            {/*
              The viewer is an iframe, and iframes are stripped from the corpus
              on purpose - a contributor's markdown must never be able to embed
              one. This element comes from app code, not from a document, so
              the sanitiser stays strict and the page still gets its viewer.
            */}
            {embedOpenApi && (
              <iframe
                className="DocsOpenApiFrame"
                src="/static/openapi/viewer.html"
                title="Yosemite Crew OpenAPI reference"
                // Redoc needs to run (allow-scripts) and fetch the same-origin
                // spec (allow-same-origin); everything else - forms, popups,
                // top-level navigation - stays denied. The frame is our own
                // static file, so this is defence in depth, not the primary
                // control, but it keeps a compromised viewer from reaching past
                // its box.
                sandbox="allow-scripts allow-same-origin"
              />
            )}

            <footer className="DocsFooter">
              <a className="DocsEditLink" href={editUrl} target="_blank" rel="noopener noreferrer">
                Edit this page on GitHub
              </a>
            </footer>
          </main>

          {toc.length > 0 && (
            <aside className="DocsToc" aria-label="On this page">
              <p className="DocsTocHeading">On this page</p>
              <ul className="DocsTocList">
                {toc.map((item) => (
                  <li
                    key={item.id}
                    className={item.depth === 3 ? 'DocsTocItemNested' : 'DocsTocItem'}
                  >
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
