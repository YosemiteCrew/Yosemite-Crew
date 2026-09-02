import Link from 'next/link';
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
  /** Sanitised HTML from render.ts. Never raw markdown, never user input. */
  html: string;
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
  html,
  editUrl,
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

            {/*
              The corpus is sanitised at build time by rehype-sanitize over the
              finished tree - every element and attribute, not just raw HTML
              nodes. See render.ts for why that ordering is the security
              boundary.
            */}
            <article className="DocsBody" dangerouslySetInnerHTML={{ __html: html }} />

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
