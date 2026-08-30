'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { IoCodeSlashOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import '@/app/ui/layout/states/states.css';

/**
 * Shown when a signed-in user reaches a developer route without the developer
 * role.
 *
 * Deliberately not `PermissionDeniedState`: that one explains an org-membership
 * problem an owner can fix in Organization → Team, which is the wrong advice
 * here. The developer portal is a separate account type, so the way out is a
 * developer account, not a role change.
 *
 * This is a terminal state rather than a redirect. Bouncing back to
 * `/developers/signin` while the session is still valid just invites the same
 * sign-in to fail the same way - the account is the problem, not the attempt.
 */
const NotADeveloperState = ({ onSignOut }: { onSignOut: () => void }) => {
  const router = useRouter();

  return (
    <div className="yc-state-wrap">
      <div className="yc-state-card">
        <span className="yc-state-icon yc-state-icon--warn" aria-hidden>
          <IoCodeSlashOutline size={25} />
        </span>
        <div className="yc-state-title">This isn&apos;t a developer account</div>
        <p className="yc-state-text">
          You&apos;re signed in, but the developer portal needs an account registered as a
          developer. Your existing account still works everywhere else — you can create a separate
          developer account to build on the API.
        </p>
        <div className="yc-state-actions">
          <Primary
            text="Create a developer account"
            onClick={() => {
              // Sign out first: the sign-up form would otherwise open on top of a
              // live session for a different account type.
              onSignOut();
              router.push('/developers/signup');
            }}
          />
          <Secondary text="Back to Yosemite Crew" onClick={() => router.push('/')} />
        </div>
      </div>
    </div>
  );
};

export default NotADeveloperState;
