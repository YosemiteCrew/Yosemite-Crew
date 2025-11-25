"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";

import "./DeveloperDocs.css";

const DOCS_BASE_PATH = "/dev-docs/index.html";

const DeveloperDocs = () => {
  return (
    <DevRouteGuard>
      <section className="DocsWrapper">
        <div className="DocsHeader">
          <Link href="/developers/home" className="DocsBackLink">
            <Icon icon="mdi:arrow-left" width={18} height={18} />
            <span>Back to portal</span>
          </Link>
          <a className="DocsOpenLink" href={DOCS_BASE_PATH} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>

        <div className="DocsFrame">
          <iframe
            src={DOCS_BASE_PATH}
            title="Yosemite Crew developer documentation"
            loading="lazy"
            allow="fullscreen"
          />
        </div>
      </section>
    </DevRouteGuard>
  );
};

export default DeveloperDocs;
