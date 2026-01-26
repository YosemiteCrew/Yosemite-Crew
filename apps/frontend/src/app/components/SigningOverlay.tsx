import React from "react";
import { createPortal } from "react-dom";
import Close from "@/app/components/Icons/Close";
import { useSigningOverlayStore } from "@/app/stores/signingOverlayStore";

const SigningOverlay = () => {
  const { open, pending, url, close } = useSigningOverlayStore();

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: "auto" }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">Sign document</div>
          <div
            role="button"
            tabIndex={0}
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                close();
              }
            }}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close signing frame"
            style={{ pointerEvents: "auto" }}
          >
            <Close />
          </div>
        </div>
        {url ? (
          <iframe
            src={url}
            title="Document signing"
            className="flex-1 w-full border-0"
            allowFullScreen
            style={{ pointerEvents: "auto" }}
          />
        ) : (
          <div className="flex-1 w-full flex items-center justify-center text-body-2 text-text-secondary">
            {pending ? "Preparing signing session..." : "Loading..."}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SigningOverlay;
