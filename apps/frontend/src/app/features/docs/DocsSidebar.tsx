'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavNode } from './docsNav';

interface DocsSidebarProps {
  nav: NavNode[];
}

/**
 * The documentation sidebar.
 *
 * Collapsible sections are a client concern, but the links themselves are
 * plain anchors so the nav works with JavaScript disabled and every page stays
 * crawlable. A section containing the current page starts open regardless of
 * its declared `collapsed`, so deep-linking into the 36 router references does
 * not land the reader in a collapsed tree with no idea where they are.
 *
 * Below 860px the whole nav collapses behind a disclosure. It used to stack
 * above the article at full height, which measured 919px of navigation on a
 * 390px-wide phone - a screen and a bit of links before the reader saw the
 * title of the page they had asked for.
 */
export default function DocsSidebar({ nav }: Readonly<DocsSidebarProps>) {
  const pathname = usePathname();

  const containsCurrent = (node: NavNode) =>
    node.kind === 'section' && node.items.some((item) => item.href === pathname);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      nav
        .filter((node): node is Extract<NavNode, { kind: 'section' }> => node.kind === 'section')
        .map((node) => [node.label, !node.collapsed || containsCurrent(node)])
    )
  );

  const toggle = (label: string) =>
    setOpen((current) => ({ ...current, [label]: !current[label] }));

  /*
   * Closed is the correct initial state on a phone and irrelevant on a desktop,
   * where the stylesheet shows the list regardless of this attribute. Deciding
   * it in CSS rather than from a JS media query keeps the server and client
   * markup identical, so there is nothing for hydration to disagree about.
   */
  const [navOpen, setNavOpen] = useState(false);

  /*
   * Tapping a link navigates; without closing, the drawer stays open on top of
   * the page it just took you to.
   *
   * Adjusted during render rather than in an effect. An effect would also fire
   * on mount, which silently overwrote the initial state - a `useState(true)`
   * default passed every assertion because the effect corrected it before
   * anything could observe it, while still shipping an expanded nav in the
   * server HTML. Comparing against the previous path only reacts to an actual
   * change, and React re-renders without committing the discarded pass.
   */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setNavOpen(false);
  }

  return (
    <nav className="DocsNav" aria-label="Documentation">
      <button
        type="button"
        className="DocsNavToggle"
        aria-expanded={navOpen}
        aria-controls="docs-nav-items"
        onClick={() => setNavOpen((current) => !current)}
      >
        <span>Documentation menu</span>
        <span className="DocsNavChevron" aria-hidden="true">
          {navOpen ? '−' : '+'}
        </span>
      </button>
      <div className="DocsNavItems" id="docs-nav-items" data-mobile-open={navOpen}>
        {nav.map((node) => {
          if (node.kind === 'link') {
            const active = node.href === pathname;
            return (
              <Link
                key={node.id}
                href={node.href}
                className={active ? 'DocsNavLink DocsNavLinkActive' : 'DocsNavLink'}
                aria-current={active ? 'page' : undefined}
              >
                {node.title}
              </Link>
            );
          }

          const expanded = open[node.label] ?? true;
          const sectionId = `docs-section-${node.label.replaceAll(/\W+/g, '-').toLowerCase()}`;

          return (
            <div key={node.label} className="DocsNavSection">
              <button
                type="button"
                className="DocsNavSectionHead"
                aria-expanded={expanded}
                aria-controls={sectionId}
                onClick={() => toggle(node.label)}
              >
                <span>{node.label}</span>
                <span className="DocsNavChevron" aria-hidden="true">
                  {expanded ? '−' : '+'}
                </span>
              </button>
              <div id={sectionId} hidden={!expanded}>
                {node.items.map((item) => {
                  const active = item.href === pathname;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={active ? 'DocsNavLink DocsNavLinkActive' : 'DocsNavLink'}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
