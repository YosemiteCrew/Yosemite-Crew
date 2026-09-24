import { useCallback, useRef, useState } from 'react';

/**
 * Token state for a form that renders <BotCheck>. Required only when a site key
 * is configured; without one every method is a no-op and the form submits as
 * it always has.
 */
export function useBotCheck(siteKey: string | undefined, requiredMessage: string) {
  const required = Boolean(siteKey);
  const tokenRef = useRef('');
  const [resetCounter, setResetCounter] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);

  const onTokenChange = useCallback(
    (token: string, widgetError?: string) => {
      tokenRef.current = token;
      setError(widgetError ?? (token ? undefined : requiredMessage));
    },
    [requiredMessage]
  );

  /** False, with the inline error shown, while a required token is missing. */
  const ensureToken = () => {
    if (required && !tokenRef.current) {
      setError(requiredMessage);
      return false;
    }
    return true;
  };

  /** Hands over the current token and resets the widget: a token works once. */
  const takeToken = () => {
    const token = tokenRef.current;
    tokenRef.current = '';
    if (required) setResetCounter((counter) => counter + 1);
    return token;
  };

  return {
    required,
    ensureToken,
    takeToken,
    widgetProps: { siteKey, error, resetCounter, onTokenChange },
  };
}
