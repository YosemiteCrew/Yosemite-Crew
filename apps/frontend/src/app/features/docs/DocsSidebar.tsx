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
 */
export default function DocsSidebar({ nav }: Readonly<DocsSidebarProps>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <nav className="DocsNav" aria-label="Documentation" data-mobile-open={mobileOpen}>
      <button
        type="button"
        className="DocsNavToggle"
        aria-label="Documentation menu"
        aria-expanded={mobileOpen}
        aria-controls="docs-navigation-links"
        onClick={() => setMobileOpen((current) => !current)}
      >
        <span>Documentation</span>
        <span aria-hidden="true">{mobileOpen ? '−' : '+'}</span>
      </button>
      <div className="DocsNavItems" id="docs-navigation-links">
        {nav.map((node) => {
          if (node.kind === 'link') {
            const active = node.href === pathname;
            return (
              <Link
                key={node.id}
                href={node.href}
                className={active ? 'DocsNavLink DocsNavLinkActive' : 'DocsNavLink'}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
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
                      onClick={() => setMobileOpen(false)}
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
