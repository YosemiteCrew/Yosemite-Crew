/**
 * Chat Page
 *
 * Dedicated page for viewing and managing all active chats in the PMS.
 * Uses Stream Chat's default UI and responsive design.
 * Renders below the navbar and takes remaining viewport height.
 * Supports opening specific appointment chats via ?appointmentId query param
 */

"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { ChatContainer, ChatScope } from "@/app/components/chat/ChatContainer";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import OrgGuard from "@/app/components/OrgGuard";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import "./page.css";

const chatScopes: Array<{
  key: ChatScope;
  label: string;
  hint: string;
}> = [
  { key: "clients", label: "Clients", hint: "Pet parents & appointments" },
  { key: "colleagues", label: "Colleagues", hint: "Internal PMS team chat" },
  { key: "groups", label: "Common groups", hint: "Shared rooms & updates" },
];

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [activeScope, setActiveScope] = useState<ChatScope>("clients");
  const appointmentId = searchParams.get("appointmentId");
  const attributes = useAuthStore((s) => s.attributes);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);

  const displayName = useMemo(() => {
    if (!attributes) return "Loading user...";
    const first = attributes.given_name || "";
    const last = attributes.family_name || "";
    const fullName = `${first} ${last}`.trim();
    return fullName || attributes.email || "You";
  }, [attributes]);

  const avatar = attributes?.picture;
  const orgName = primaryOrgId ? orgsById[primaryOrgId]?.name : undefined;
  const email = attributes?.email;

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    if (parts.length === 0) return "Y";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "Y";
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [displayName]);

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="chat-page">
          <div className="chat-shell">
            <div className="chat-hero">
              <div className="chat-identity-card">
                <div className="chat-identity-avatar">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={displayName}
                      width={56}
                      height={56}
                      className="chat-identity-avatar__image"
                    />
                  ) : (
                    <div className="chat-identity-avatar__fallback">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="chat-identity-copy">
                  <p className="chat-identity-eyebrow">Messaging as</p>
                  <h1 className="chat-identity-name">{displayName}</h1>
                  <p className="chat-identity-meta">
                    {orgName ? `${orgName} • ` : ""}
                    {email ?? "Signed in"}
                  </p>
                </div>
              </div>

              <div className="chat-scope-switcher" role="tablist" aria-label="Chat audience">
                {chatScopes.map((scope) => {
                  const isActive = activeScope === scope.key;
                  return (
                    <button
                      key={scope.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`chat-scope ${isActive ? "chat-scope--active" : ""}`}
                      onClick={() => setActiveScope(scope.key)}
                    >
                      <span className="chat-scope__label">{scope.label}</span>
                      <span className="chat-scope__hint">{scope.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="chat-workspace">
              <ChatContainer
                appointmentId={appointmentId || undefined}
                scope={activeScope}
                className="chat-module"
              />
            </div>
          </div>
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </React.Suspense>
  );
}
