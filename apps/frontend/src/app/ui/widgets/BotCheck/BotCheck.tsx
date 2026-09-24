'use client';
import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';
import { useTheme } from '@/app/ui/theme';
import { FieldError } from '@/app/features/auth/pages/authForm';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_UNAVAILABLE_ERROR =
  'Bot verification is unavailable. Please try again later.';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: 'flexible';
      theme: 'light' | 'dark';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => boolean;
      'unsupported-callback': () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

const getTurnstile = () =>
  (globalThis.window as (Window & { turnstile?: TurnstileApi }) | undefined)?.turnstile;

export type BotCheckProps = {
  siteKey?: string;
  /** Names the form the token is issued for; the server only accepts a matching one. */
  action: string;
  error?: string;
  /** Bump after every submit attempt: a token can only be used once. */
  resetCounter: number;
  onTokenChange: (token: string, error?: string) => void;
};

/**
 * Cloudflare Turnstile widget. Reports each new token (or '' when it expires or
 * fails) through onTokenChange; the form sends the token with its submission.
 */
export const BotCheck = ({
  siteKey,
  action,
  error,
  resetCounter,
  onTokenChange,
}: BotCheckProps) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);

  const renderWidget = useCallback(() => {
    const turnstile = getTurnstile();
    if (!siteKey || !turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      size: 'flexible',
      theme,
      callback: onTokenChange,
      'expired-callback': () => onTokenChange(''),
      'error-callback': () => {
        onTokenChange('', TURNSTILE_UNAVAILABLE_ERROR);
        return true;
      },
      'unsupported-callback': () => onTokenChange('', TURNSTILE_UNAVAILABLE_ERROR),
    });
  }, [action, onTokenChange, siteKey, theme]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current) getTurnstile()?.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (resetCounter > 0 && widgetIdRef.current) {
      getTurnstile()?.reset(widgetIdRef.current);
    }
  }, [resetCounter]);

  if (!siteKey) return <FieldError message={TURNSTILE_UNAVAILABLE_ERROR} />;

  return (
    <>
      <Script
        src={TURNSTILE_SCRIPT}
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => onTokenChange('', TURNSTILE_UNAVAILABLE_ERROR)}
      />
      <div ref={containerRef} style={{ minHeight: 65 }} />
      <FieldError message={error} />
    </>
  );
};

export default BotCheck;
