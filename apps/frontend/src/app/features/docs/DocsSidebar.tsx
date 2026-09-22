'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavNode } from './docsNav';

interface DocsSidebarProps {
  nav: NavNode[];
}

/**
 * The no-JavaScript floor for the phone disclosure, served inside `<noscript>`.
 *
 * Below 860px the tree is hidden by a media query keyed on `data-open`, and
 * `data-open` is React state whose server-rendered value is `false`. With
 * scripting off nothing can ever change it, and the only control that would is
 * a button with nothing behind it but an `onClick` handler - so the whole
 * documentation navigation is unreachable, anchors present in the DOM or not.
 * These two rules put it back to what it was before the disclosure existed:
 * the full tree above the article, and no dead control offered.
 *
 * It has to be `<noscript>`, not a rule in `docs.css`, because CSS cannot
 * distinguish "scripting is off" from "React has not hydrated yet". Serving
 * `data-open="true"` and collapsing it in an effect would read the same to the
 * cascade, and would flash the entire tree above the article on every phone
 * load - which is the defect the disclosure was added to remove.
 *
 * Quote-free and `&<>`-free on purpose: this is the text content of a raw-text
 * element, so an escaped `'` would ship as `&#x27;` and silently void the
 * selector it sits in. `[data-open=false]` is an unquoted attribute value,
 * which is valid CSS because `false` is a valid identifier.
 *
 * Deliberately not in here: revealing a section declared `collapsed`, whose
 * body is hidden by the `hidden` attribute rather than by this media query.
 * That gap predates the disclosure, and Tailwind's preflight declares
 * `[hidden]{display:none!important}` in a cascade layer, which an unlayered
 * override cannot outrank at any specificity or importance. It needs the
 * attribute replaced, not a rule added - see issue #3515.
 */
export const DOCS_NAV_NO_JS_CSS = [
  '.DocsNav .DocsNavToggle{display:none}',
  '.DocsNav .DocsNavTree[data-open=false]{display:block}',
].join('');

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
 * working - `DOCS_NAV_NO_JS_CSS` is what makes it reachable. See that constant
 * for why the no-JS floor cannot be expressed in `docs.css`.
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
              <div id={sectionId} hidden={!expanded}>
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
