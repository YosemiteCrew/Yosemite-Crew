"use client";
import React, { useEffect, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react/dist/iconify.js";
import { publicRoutes } from "@/app/utils/const";

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
  const pathname = usePathname();

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
    <div
      className={`${publicRoutes.has(pathname) ? "flex!" : "hidden!"} fixed left-0 bottom-[30px] z-9999 flex items-center justify-center w-full pointer-events-none`}
    >
      <div className="px-6 py-[12px] flex items-center justify-center gap-2 bg-text-primary pointer-events-auto rounded-2xl">
        <div className="text-body-2 text-white">Star us on Github</div>
        <a
          href="https://github.com/YosemiteCrew/Yosemite-Crew"
          target="_blank"
          className="flex items-center justify-center gap-2 rounded-2xl cursor-pointer bg-white px-2"
        >
          <div className="flex items-center gap-1">
            <Icon icon="mdi:github" width="28" height="28" color="#302F2E" />
            <div className="text-caption-1 text-text-primary">Stars</div>
          </div>
          <div className="h-[15px] w-px bg-text-tertiary"></div>
          <div className="text-caption-1 text-text-brand">
            {error ?? (stars === null ? "…" : formatStars(stars))}
          </div>
        </a>
        <button
          className="border-none bg-text-primary"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <IoCloseSharp color="#fff" size={18} />
        </button>
      </div>
    </div>
  );
};

export default Github;
