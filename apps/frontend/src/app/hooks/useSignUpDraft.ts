import { useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'yc_signup_draft';
const DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes

type SignUpDraft = {
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: number;
};

const readDraft = (): Omit<SignUpDraft, 'expiresAt'> | null => {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: SignUpDraft = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      return null;
    }
    return { firstName: parsed.firstName, lastName: parsed.lastName, email: parsed.email };
  } catch {
    return null;
  }
};

const writeDraft = (firstName: string, lastName: string, email: string) => {
  try {
    const draft: SignUpDraft = {
      firstName,
      lastName,
      email,
      expiresAt: Date.now() + DRAFT_TTL_MS,
    };
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage unavailable (e.g. private mode quota exceeded) — silently ignore
  }
};

const clearDraft = () => {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

type UseSignUpDraftOptions = {
  firstName: string;
  lastName: string;
  email: string;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setEmail: (v: string) => void;
};

/**
 * Persists signup form state (non-sensitive fields only) to sessionStorage so
 * that navigating to Terms / Privacy and back restores what the user typed.
 *
 * Passwords are intentionally never persisted.
 */
export const useSignUpDraft = ({
  firstName,
  lastName,
  email,
  setFirstName,
  setLastName,
  setEmail,
}: UseSignUpDraftOptions) => {
  const restoredRef = useRef(false);

  // Restore on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readDraft();
    if (!draft) return;
    if (draft.firstName) setFirstName(draft.firstName);
    if (draft.lastName) setLastName(draft.lastName);
    if (draft.email) setEmail(draft.email);
  }, [setFirstName, setLastName, setEmail]);

  // Persist whenever non-sensitive fields change
  useEffect(() => {
    if (!restoredRef.current) return;
    if (!firstName && !lastName && !email) return;
    writeDraft(firstName, lastName, email);
  }, [firstName, lastName, email]);

  const clearSignUpDraft = useCallback(() => {
    clearDraft();
  }, []);

  return { clearSignUpDraft };
};
