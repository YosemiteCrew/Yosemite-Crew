'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavNode } from './docsNav';
import { DOCS_NAV_NO_JS_CSS } from './docsNavNoJsCss';

interface DocsSidebarProps {
  nav: NavNode[];
}

/**
 * The documentation sidebar.
 *
 * Collapsible sections are a client concern, but the links themselves are
 * plain anchors so every page stays crawlable. A section containing the
 * current page starts open regardless of its declared `collapsed`, so
 * deep-linking into the 36 router references does not land the reader in a
 * collapsed tree with no idea where they are.
 *
 * Below 860px the whole tree sits behind `.DocsNavToggle`. The tree is hidden
 * by a media query keyed on `data-open`, never by this component: that is what
 * keeps the desktop rail persistently visible whatever `menuOpen` happens to
 * be, and it is why the toggle carries `aria-controls` rather than the tree
 * being conditionally rendered.
 *
 * Following a link closes the menu. Next keeps this component mounted across a
 * docs-to-docs route change, so without that the reader taps a link and lands
 * with the full tree still above the article - the defect the disclosure
 * exists to fix, recurring on every click after the first.
 *
 * With scripting off the links are still plain anchors, so the nav keeps
 * working - `DOCS_NAV_NO_JS_CSS` (in `docsNavNoJsCss.ts`) is what makes it
 * reachable. See that constant for why the no-JS floor cannot be expressed in
 * `docs.css`.
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

  const [menuOpen, setMenuOpen] = useState(false);

  const toggle = (label: string) =>
    setOpen((current) => ({ ...current, [label]: !current[label] }));

  return (
    <nav className="DocsNav" aria-label="Documentation">
      <noscript>
        <style>{DOCS_NAV_NO_JS_CSS}</style>
      </noscript>

      <button
        type="button"
        className="DocsNavToggle"
        aria-expanded={menuOpen}
        aria-controls="docs-nav-tree"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span>Documentation menu</span>
        <span className="DocsNavChevron" aria-hidden="true">
          {menuOpen ? '−' : '+'}
        </span>
      </button>

      <div id="docs-nav-tree" className="DocsNavTree" data-open={menuOpen}>
        {nav.map((node) => {
          if (node.kind === 'link') {
            const active = node.href === pathname;
            return (
              <Link
                key={node.id}
                href={node.href}
                className={active ? 'DocsNavLink DocsNavLinkActive' : 'DocsNavLink'}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
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
              <div id={sectionId} data-expanded={expanded}>
                {node.items.map((item) => {
                  const active = item.href === pathname;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={active ? 'DocsNavLink DocsNavLinkActive' : 'DocsNavLink'}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
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
