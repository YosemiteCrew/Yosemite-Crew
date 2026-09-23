'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { rankStrictMatches, retrieveJudgmentCandidates } from './searchRanking';
import type { RankedSearchDoc } from './searchRanking';
import type { SearchDoc } from './searchIndex';

/**
 * Client-side documentation search.
 *
 * The index is a prerendered JSON route, fetched once on first focus rather
 * than on mount, so a reader who never searches never pays for it. Its size is
 * held under 400 KB by searchIndex.test.ts rather than quoted here, where
 * nothing could contradict the figure.
 *
 * Exact all-term matches render first. When fewer than three pages match, a
 * same-origin server route may widen candidates to any matching term and ask
 * for a typed relevance judgment. The deterministic fallback ranks title hits
 * above body hits.
 */

const INDEX_URL = '/docs/search-index.json';
const MAX_RESULTS = 8;
const RERANK_DEBOUNCE_MS = 120;

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringOrder = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const rankedCandidates = (order: unknown[], docs: SearchDoc[], query: string): SearchDoc[] => {
  const candidates = retrieveJudgmentCandidates(docs, query);
  const byHref = new Map(candidates.map((candidate) => [candidate.href, candidate]));
  return [...new Set(order)]
    .map((href) => byHref.get(href as string))
    .filter((candidate): candidate is RankedSearchDoc => candidate !== undefined)
    .slice(0, MAX_RESULTS);
};

export default function DocsSearch() {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [judgedResults, setJudgedResults] = useState<SearchDoc[] | null>(null);
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

  const deterministicResults = docs ? rankStrictMatches(docs, query).slice(0, MAX_RESULTS) : [];
  const results = judgedResults ?? deterministicResults;
  const showPanel = open && query.trim().length > 0;
  const activeOptionId = activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!open || !docs || !query.trim()) return undefined;

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      fetch('/api/docs/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((result: unknown) => {
          if (controller.signal.aborted || typeof result !== 'object' || result === null) return;

          const order = (result as { order?: unknown }).order;
          if (!isStringOrder(order)) return;

          const ranked = rankedCandidates(order, docs, query);

          if (order.length > 0 && ranked.length === 0) return;
          setJudgedResults(ranked);
          setActiveIndex(-1);
        })
        .catch(() => undefined);
    }, RERANK_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [docs, open, query]);

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
          setJudgedResults(null);
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
