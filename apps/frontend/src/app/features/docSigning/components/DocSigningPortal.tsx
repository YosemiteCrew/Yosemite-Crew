"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { fetchDocumensoRedirectUrl } from "@/app/features/documents/services/documensoService";
import { YosemiteLoader } from "@/app/ui/overlays/Loader";

type DocSigningPortalProps = {
  embedded?: boolean;
};

const DocSigningPortal = ({ embedded = false }: DocSigningPortalProps) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const portalUrl = useMemo(() => {
    if (!redirectUrl) return null;
    try {
      const url = new URL(redirectUrl);
      url.pathname = url.pathname.replaceAll(/\/{2,}/g, "/");
      return url.toString();
    } catch {
      return redirectUrl;
    }
  }, [redirectUrl]);

  useEffect(() => {
    const run = async () => {
      if (!primaryOrgId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDocumensoRedirectUrl(primaryOrgId);
        setRedirectUrl(res.redirectUrl);
      } catch (e: any) {
        console.error("Failed to fetch Documenso portal URL", e);
        setError(
          e?.response?.data?.message || e?.message || "Unable to load Doc Signing portal",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [primaryOrgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <YosemiteLoader label="Loading Doc Signing" />
      </div>
    );
  }

  if (error) {
    return <div className="text-body-3 text-error-main">{error}</div>;
  }

  if (!portalUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        <div className="flex flex-col items-center gap-4 max-w-lg text-center">
          <h2 className="text-heading-2 text-text-primary">Document Signing Portal</h2>
          <p className="text-body-3 text-text-secondary">Portal link not available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden pb-3 ${
        embedded ? "h-[75vh] min-h-[560px]" : "h-[calc(100vh-140px)]"
      }`}
    >
      <iframe
        src={portalUrl}
        className="w-full h-full"
        title="Doc Signing Portal"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
};

export default DocSigningPortal;
