'use client';
import React, { useState } from 'react';

import { Secondary } from '@/app/ui/primitives/Buttons';
import type { IssuedApiKey } from '@/app/services/developerApiKeys';

/**
 * The one moment the plaintext key exists in the UI.
 *
 * `copied` lives here rather than on the page because it is only meaningful
 * while this is on screen: the page unmounts this on Done, which clears the flag
 * without anyone having to remember to reset it.
 */
const KeyReveal = ({ issued, onDone }: { issued: IssuedApiKey; onDone: () => void }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(issued.apiKey);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (permissions, insecure origin).
      // Staying on "Copy" is the honest result - the key is still selectable.
      setCopied(false);
    }
  };

  return (
    <div className="DevApiKeys-reveal" role="alert">
      <p className="text-body-2 text-text-primary">
        Copy your new key now. For your security it won&apos;t be shown again.
      </p>
      <div className="DevApiKeys-secret">
        <code data-testid="issued-secret">{issued.apiKey}</code>
        <Secondary
          text={copied ? 'Copied' : 'Copy'}
          onClick={handleCopy}
          style={{ maxWidth: 120 }}
        />
      </div>
      <Secondary text="Done" onClick={onDone} style={{ maxWidth: 120 }} />
    </div>
  );
};

export default KeyReveal;
