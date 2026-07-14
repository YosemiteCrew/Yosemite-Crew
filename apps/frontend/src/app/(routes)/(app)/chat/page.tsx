/**
 * Chat Page
 *
 * Full-bleed chat workspace. Audience switching (Clients / Colleagues / Groups)
 * now lives inside the sidebar (ChatContainer); this page only hosts the
 * workspace and keeps the ?appointmentId deep-link wiring. The signed-in user
 * and organisation already appear in the global top bar, so the old "Messaging
 * as" identity card is gone.
 */

'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChatScope } from '@/app/features/chat/components/ChatContainer';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import './page.css';

const ChatContainer = dynamic(
  () =>
    import('@/app/features/chat/components/ChatContainer').then((m) => ({
      default: m.ChatContainer,
    })),
  { ssr: false, loading: () => null }
);

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeScope, setActiveScope] = useState<ChatScope>('clients');
  const appointmentId = searchParams.get('appointmentId');
  const visibleScope = appointmentId ? 'clients' : activeScope;
  const effectiveAppointmentId = visibleScope === 'clients' ? appointmentId : null;

  const clearAppointmentDeepLink = () => {
    router.replace('/chat', { scroll: false });
  };

  const handleScopeChange = (scope: ChatScope) => {
    setActiveScope(scope);
    if (appointmentId && scope !== 'clients') {
      clearAppointmentDeepLink();
    }
  };

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="chat-page">
          <div className="chat-shell">
            <div className="chat-workspace">
              <ChatContainer
                appointmentId={effectiveAppointmentId || undefined}
                onChannelSelect={(channel) => {
                  if (!channel || !appointmentId) return;
                  clearAppointmentDeepLink();
                }}
                scope={visibleScope}
                onScopeChange={handleScopeChange}
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
    <Suspense fallback={<div>Loading…</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
