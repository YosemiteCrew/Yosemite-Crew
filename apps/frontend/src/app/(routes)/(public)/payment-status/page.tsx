"use client";
import { Secondary } from "@/app/components/Buttons";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

type DisplayState = "paid" | "no_payment_required" | "unpaid";

type Return = {
  status: DisplayState;
  total: number;
};

const shortId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

function Page() {
  const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");

  const [data, setData] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopped, setStopped] = useState(false);
  const stopPollingRef = useRef(false);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setStopped(false);
    stopPollingRef.current = false;
  }, [session_id]);

  useEffect(() => {
    if (!session_id) {
      setLoading(false);
      setStopped(true);
      setData(null);
      return;
    }

    const safeSessionId = session_id;
    let alive = true;
    let attempts = 0;
    const maxAttempts = 30;

    async function fetchStatus() {
      if (stopPollingRef.current) return;
      try {
        const res = await fetch(
          `https://devapi.yosemitecrew.com/fhir/v1/invoice/?session_id=${encodeURIComponent(safeSessionId)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as Return;
        if (!alive) return;
        setData(json);
        setLoading(false);
        attempts += 1;
        if (attempts >= maxAttempts) {
          stopPollingRef.current = true;
          setStopped(true);
        }
      } catch {
        if (!alive) return;
        setLoading(false);
        setData(null);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [session_id]);

  const title = useMemo(() => {
    if (!session_id || !data) return "Missing payment session";
    if (data.status === "paid") return "Payment complete";
    if (data.status === "no_payment_required") return "Payment cancelled";
    return "Waiting for confirmation";
  }, [data, session_id]);

  const subtitle = useMemo(() => {
    if (!session_id || !data) {
      return "We could not find a payment session in the URL.";
    }
    if (data.status === "paid") {
      return "Thanks for your payment. Your receipt will arrive shortly.";
    }
    if (data.status === "no_payment_required") {
      return "This payment did not complete. If this looks wrong, contact support.";
    }
    if (loading) {
      return "We are confirming your payment with the bank. This usually takes a few seconds.";
    }
    return "We are still waiting on confirmation. You can safely close this tab.";
  }, [data, session_id, loading]);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10 bg-[radial-gradient(circle_at_10%_10%,rgba(250,238,210,0.6),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(210,235,248,0.6),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(215,245,230,0.7),transparent_50%)]">
      <div className="w-full max-w-xl bg-white/80 border border-card-border rounded-2xl px-6 py-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative flex items-center justify-center w-24 h-24 rounded-full">
            {!data && (
              <svg className="w-24 h-24" viewBox="0 0 120 120" aria-hidden>
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="6"
                />
                <path
                  d="M42 42l36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M78 42l-36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {data && data.status === "paid" && (
              <svg className="w-24 h-24" viewBox="0 0 120 120" aria-hidden>
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="6"
                />
                <path
                  d="M38 62l16 16 30-34"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {data && data.status === "unpaid" && (
              <div className="flex gap-2" aria-hidden>
                <span className="w-3.5 h-3.5 rounded-full bg-slate-900 animate-bounce" />
                <span className="w-3.5 h-3.5 rounded-full bg-slate-900 animate-bounce [animation-delay:150ms]" />
                <span className="w-3.5 h-3.5 rounded-full bg-slate-900 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            {data && data.status === "no_payment_required" && (
              <svg className="w-24 h-24" viewBox="0 0 120 120" aria-hidden>
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="6"
                />
                <path
                  d="M42 42l36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M78 42l-36 36"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-body-4 text-text-tertiary">Yosemite Crew</div>
            <div className="text-heading-1 text-text-primary">{title}</div>
            <div className="text-body-3 text-text-secondary max-w-xl">
              {subtitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-caption-1 text-text-primary">
            {session_id && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Session {shortId(session_id)}
              </span>
            )}
            {data?.status && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Status {data.status.replaceAll("_", " ")}
              </span>
            )}
            {stopped && (
              <span className="px-4 py-2 rounded-full border border-card-border bg-white/70">
                Auto-check stopped
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Secondary text="Return home" href="/" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
