"use client";
import React, { useEffect, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { Icon } from "@iconify/react/dist/iconify.js";

import "./Github.css";

const owner = "YosemiteCrew";
const repo = "Yosemite-Crew";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cacheKey = (o: string, r: string) => `gh:stars:${o}/${r}`;

type CacheShape = { value: number; ts: number };

const readCache = (o: string, r: string): number | null => {
  try {
    const raw = localStorage.getItem(cacheKey(o, r));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return typeof parsed.value === "number" ? parsed.value : null;
  } catch {
    return null;
  }
};

const writeCache = (o: string, r: string, value: number) => {
  try {
    const payload: CacheShape = { value, ts: Date.now() };
    localStorage.setItem(cacheKey(o, r), JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
};

const Github = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [stars, setStars] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    setIsOpen(false);
  };

  const formatStars = (n: number) =>
    Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(owner, repo);
    if (cached !== null) setStars(cached);

    async function loadStars() {
      setError(null);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10_000);

        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            signal: ctrl.signal,
            headers: {
              // These headers are optional but nice to include
              Accept: "application/vnd.github+json",
            },
          }
        );
        clearTimeout(t);

        if (!res.ok) {
          // If we’re rate-limited or offline, keep cached value if present
          if (!cancelled) setError("—");
          return;
        }

        const data = await res.json();
        const count = Number(data?.stargazers_count ?? 0);

        if (!Number.isFinite(count)) throw new Error("Bad star count");

        if (!cancelled) {
          setStars(count);
          writeCache(owner, repo, count);
        }
      } catch {
        if (!cancelled) setError("—");
      }
    }
    loadStars();

    // optional: refresh every 15 minutes while banner is mounted
    const id = setInterval(loadStars, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="GithubWrapper">
      <div className="GithubMain">
        <div className="GithubTitle">Star us on Github</div>
        <a
          href="https://github.com/YosemiteCrew/Yosemite-Crew"
          target="_blank"
          className="GithubStar"
        >
          <div className="Title">
            <Icon icon="mdi:github" width="28" height="28" color="#302F2E" />
            <p>Star</p>
          </div>
          <div className="Line"></div>
          <h6 className="Stars">
            {error ?? (stars === null ? "…" : formatStars(stars))}
          </h6>
        </a>
        <button
          className="CloseButton"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <IoCloseSharp color="#fff" size={20} />
        </button>
      </div>
    </div>
  );
};

export default Github;
