'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { SearchDoc } from './searchIndex';

/**
 * Client-side documentation search.
 *
 * The index is a prerendered JSON route, fetched once on first focus rather
 * than on mount, so a reader who never searches never pays for it. It is 108 KB
 * for the whole corpus.
 *
 * Matching is deliberately simple: every term must appear in the title or the
 * body text. That is enough for 52 pages and avoids shipping a scoring library
 * for a corpus this size. Titles rank above body hits.
 */

const INDEX_URL = '/docs/search-index.json';
const MAX_RESULTS = 8;

interface Ranked extends SearchDoc {
  score: number;
}

const rank = (docs: SearchDoc[], query: string): Ranked[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return docs
    .map((doc) => {
      const title = doc.title.toLowerCase();
      const text = doc.text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        else if (text.includes(term)) score += 1;
        else return null;
      }
      return { ...doc, score };
    })
    .filter((doc): doc is Ranked => doc !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS);
};

export default function DocsSearch() {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const load = () => {
    if (docs || loadFailed) return;
    fetch(INDEX_URL)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data: SearchDoc[]) => setDocs(data))
      .catch(() => setLoadFailed(true));
  };

  // Clicking away closes the results without clearing what was typed.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const results = docs ? rank(docs, query) : [];
  const showPanel = open && query.trim().length > 0;

  return (
    <div className="DocsSearch" ref={containerRef}>
      <input
        type="search"
        className="DocsSearchInput"
        placeholder="Search the docs"
        aria-label="Search the documentation"
        aria-controls={listId}
        aria-expanded={showPanel}
        role="combobox"
        value={query}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />

      {showPanel && (
        <div className="DocsSearchPanel" id={listId} role="listbox">
          {loadFailed && (
            <p className="DocsSearchEmpty">
              Search is unavailable right now. Use the sidebar to browse.
            </p>
          )}
          {!loadFailed && !docs && <p className="DocsSearchEmpty">Loading…</p>}
          {!loadFailed && docs && results.length === 0 && (
            <p className="DocsSearchEmpty">No matches for “{query}”.</p>
          )}
          {results.map((result) => (
            <Link
              key={result.href}
              href={result.href}
              className="DocsSearchResult"
              role="option"
              aria-selected="false"
              onClick={() => setOpen(false)}
            >
              <span className="DocsSearchResultTitle">{result.title}</span>
              <span className="DocsSearchResultSection">{result.section}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
