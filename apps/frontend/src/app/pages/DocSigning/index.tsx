"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import OrgGuard from "@/app/components/OrgGuard";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useOrgStore } from "@/app/stores/orgStore";
import { fetchDocumensoRedirectUrl } from "@/app/services/documensoService";
import { Primary } from "@/app/components/Buttons";
import { YosemiteLoader } from "@/app/components/Loader";

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

  const handleOpenPortal = useCallback(() => {
    if (portalUrl) {
      window.open(portalUrl, "_blank", "noopener,noreferrer");
    }
  }, [portalUrl]);

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="flex flex-col gap-6 w-full h-full">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <YosemiteLoader label="Loading Doc Signing" />
            </div>
          ) : error ? (
            <div className="text-body-3 text-error-main">{error}</div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
              <div className="flex flex-col items-center gap-4 max-w-lg text-center">
                <h2 className="text-heading-2 text-text-primary">
                  Document Signing Portal
                </h2>
                <p className="text-body-3 text-text-secondary">
                  View, manage, and sign documents securely. Track document status,
                  review audit trails, and manage all your organisation&apos;s documents in one place.
                </p>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <Primary
                  text="Open Doc Signing Portal"
                  href="#"
                  onClick={handleOpenPortal}
                  isDisabled={!portalUrl}
                />
                {!portalUrl && (
                  <p className="text-body-4 text-text-tertiary text-center">
                    Portal link not available
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-8 text-center">
                <p className="text-body-4 text-text-tertiary">
                  The portal will open in a new tab for the best experience.
                </p>
              </div>
            </div>
          )}
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default DocSigning;
