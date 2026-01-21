"use client";
import React, { useMemo } from "react";
import Link from "next/link";

import { Primary, Secondary } from "@/app/components/Buttons";
import { useAuthStore } from "@/app/stores/authStore";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";

import "./DeveloperPortalHome.css";
import "../Organizations/Organizations.css";

const DeveloperPortalHome = () => {
  const { session } = useAuthStore();

  const idTokenPayload = session?.getIdToken().decodePayload();
  const displayName = useMemo(() => {
    const name = `${idTokenPayload?.given_name || ""} ${
      idTokenPayload?.family_name || ""
    }`.trim();
    if (name) return name;
    if (idTokenPayload?.email) return idTokenPayload.email;
    return "Developer";
  }, [idTokenPayload?.email, idTokenPayload?.family_name, idTokenPayload?.given_name]);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h2 className="text-heading-1 text-text-primary">Developer Home</h2>
          <Primary text="View docs" href="/developers/documentation" style={{ maxWidth: 180 }} />
        </div>

        <section className="DevPortalHome">
          <div className="dev-portal-hero">
            <div className="dev-hero-copy">
              <span className="dev-badge text-caption-2">Developer</span>
              <h2 className="text-heading-1 text-text-primary">Welcome back, {displayName}</h2>
              <p className="text-body-3 text-text-secondary dev-hero-subtext">
                Build, customise, and launch apps with Yosemite Crew. Access APIs,
                SDKs, and starter templates designed for the animal health
                ecosystem.
              </p>
              <div className="dev-hero-actions">
                <Secondary text="Contact support" href="/contact" />
              </div>
            </div>
            <div className="dev-hero-card">
              <h4 className="text-heading-3 text-neutral-0">Quick status</h4>
              <ul>
                <li>
                  <span className="text-body-4 text-neutral-200">Portal access</span>
                  <strong className="text-body-4-emphasis text-neutral-0">Active</strong>
                </li>
                <li>
                  <span className="text-body-4 text-neutral-200">Environment</span>
                  <strong className="text-body-4-emphasis text-neutral-0">Dev</strong>
                </li>
                <li>
                  <span className="text-body-4 text-neutral-200">Next step</span>
                  <strong className="text-body-4-emphasis text-neutral-0">Browse Documentation</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className="dev-portal-grid">
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h4 className="text-heading-3 text-text-primary">Quick links</h4>
                <span className="dev-card-pill secondary text-caption-2">Resources</span>
              </div>
              <div className="dev-links">
                <Link href="/contact" className="text-body-4-emphasis text-text-primary">Partner with Yosemite Crew</Link>
                <Link href="/privacy-policy" className="text-body-4-emphasis text-text-primary">Security & compliance</Link>
              </div>
            </div>
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h4 className="text-heading-3 text-text-primary">Recent activity</h4>
                <span className="dev-card-pill muted text-caption-2">Coming soon</span>
              </div>
              <p className="text-body-4 text-text-tertiary dev-empty">You will see build and release activity here.</p>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPortalHome;
