'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SearchDoc } from './searchIndex';

/**
 * Client-side documentation search.
 *
 * The index is a prerendered JSON route, fetched once on first focus rather
 * than on mount, so a reader who never searches never pays for it. It is about
 * 344 KB for the 156-page corpus.
 *
 * Matching is deliberately simple: every term must appear in the title or the
 * body text. That is enough for 156 pages and avoids shipping a scoring library
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const listId = useId();

  const load = () => {
    if (docs || loadPromiseRef.current) return loadPromiseRef.current;
    setLoadFailed(false);
    const loadPromise = fetch(INDEX_URL)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data: SearchDoc[]) => {
        setDocs(data);
        setActiveIndex(-1);
      })
      .catch(() => {
        setLoadFailed(true);
      })
      .finally(() => {
        loadPromiseRef.current = null;
      });
    loadPromiseRef.current = loadPromise;
    return loadPromise;
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
  const activeOptionId = activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showPanel || results.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = Math.min(activeIndex + 1, results.length - 1);
    else if (event.key === 'ArrowUp')
      nextIndex = Math.max(activeIndex < 0 ? 0 : activeIndex - 1, 0);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = results.length - 1;
    else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      setActiveIndex(nextIndex);
    }
  };

  return (
    <div className="DocsSearch" ref={containerRef}>
      <input
        type="search"
        className="DocsSearchInput"
        placeholder="Search the docs"
        aria-label="Search the documentation"
        aria-controls={listId}
        aria-expanded={showPanel}
        aria-activedescendant={activeOptionId}
        role="combobox"
        value={query}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {showPanel && (
        <div className="DocsSearchPanel" id={listId} role="listbox">
          {loadFailed && (
            <div className="DocsSearchEmpty">
              <span>Search is unavailable right now. Use the sidebar to browse.</span>
              <button type="button" className="DocsSearchRetry" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          {!loadFailed && !docs && <p className="DocsSearchEmpty">Loading…</p>}
          {!loadFailed && docs && results.length === 0 && (
            <p className="DocsSearchEmpty">No matches for “{query}”.</p>
          )}
          {results.map((result, index) => (
            <Link
              key={result.href}
              id={`${listId}-option-${index}`}
              href={result.href}
              className="DocsSearchResult"
              role="option"
              aria-selected={index === activeIndex}
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
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
