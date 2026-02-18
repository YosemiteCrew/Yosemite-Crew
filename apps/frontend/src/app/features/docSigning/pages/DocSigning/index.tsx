"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useOrgStore } from "@/app/stores/orgStore";
import { fetchDocumensoRedirectUrl } from "@/app/features/documents/services/documensoService";
import { YosemiteLoader } from "@/app/ui/overlays/Loader";

const DocSigning = () => {
  useLoadOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // Normalize URL by removing double slashes in pathname
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

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="flex items-center justify-center min-h-[60vh]">
        <YosemiteLoader label="Loading Doc Signing" />
      </div>
    );
  } else if (error) {
    content = <div className="text-body-3 text-error-main">{error}</div>;
  } else {
    content = portalUrl ? (
      <div className="w-full h-full min-h-[calc(100vh-140px)] overflow-hidden pb-3">
        <iframe
          src={portalUrl}
          className="w-full h-full"
          title="Doc Signing Portal"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        <div className="flex flex-col items-center gap-4 max-w-lg text-center">
          <h2 className="text-heading-2 text-text-primary">
            Document Signing Portal
          </h2>
          <p className="text-body-3 text-text-secondary">
            Portal link not available
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="flex flex-col gap-6 w-full h-full">
          {content}
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default DocSigning;
