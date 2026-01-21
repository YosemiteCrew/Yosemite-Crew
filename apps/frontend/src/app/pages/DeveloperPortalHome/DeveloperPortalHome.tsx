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
          <h2>Developer Home</h2>
          <Primary text="View docs" href="/developers/documentation" style={{ maxWidth: 180 }} />
        </div>

        <section className="DevPortalHome">
          <div className="dev-portal-hero">
            <div className="dev-hero-copy">
              <p className="dev-badge">Developer</p>
              <h2>Welcome back, {displayName}</h2>
              <p className="dev-hero-subtext">
                Build, customise, and launch apps with Yosemite Crew. Access APIs,
                SDKs, and starter templates designed for the animal health
                ecosystem.
              </p>
              <div className="dev-hero-actions">
                <Secondary text="Contact support" href="/contact" />
              </div>
            </div>
            <div className="dev-hero-card">
              <h4>Quick status</h4>
              <ul>
                <li>
                  <span>Portal access</span>
                  <strong>Active</strong>
                </li>
                <li>
                  <span>Environment</span>
                  <strong>Dev</strong>
                </li>
                <li>
                  <span>Next step</span>
                  <strong>Browse Documentation</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className="dev-portal-grid">
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h4>Quick links</h4>
                <span className="dev-card-pill secondary">Resources</span>
              </div>
              <div className="dev-links">
                <Link href="/contact">Partner with Yosemite Crew</Link>
                <Link href="/privacy-policy">Security & compliance</Link>
              </div>
            </div>
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h4>Recent activity</h4>
                <span className="dev-card-pill muted">Coming soon</span>
              </div>
              <p className="dev-empty">You will see build and release activity here.</p>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPortalHome;
