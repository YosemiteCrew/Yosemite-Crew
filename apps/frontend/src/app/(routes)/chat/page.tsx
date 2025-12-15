/**
 * Chat Page
 *
 * Dedicated page for viewing and managing all active chats in the PMS.
 * Uses Stream Chat's default UI and responsive design.
 * Renders below the navbar and takes remaining viewport height.
 * Supports opening specific appointment chats via ?appointmentId query param
 */

"use client";

import React from "react";
import { ChatContainer } from "@/app/components/chat/ChatContainer";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import OrgGuard from "@/app/components/OrgGuard";
import { useSearchParams } from "next/navigation";
import "./page.css";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  return (
    <div className="chat-page">
      <ProtectedRoute>
        <OrgGuard>
          <ChatContainer appointmentId={appointmentId || undefined} />
        </OrgGuard>
      </ProtectedRoute>
    </div>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </React.Suspense>
  );
}
