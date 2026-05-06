'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

const CONSENT_KEY = 'cookieConsentGiven';

const readConsent = (): boolean => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
};

type Props = { projectId: string };

const ClarityScript = ({ projectId }: Props) => {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(readConsent());

    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY) {
        setConsented(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!consented) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${projectId}");`}
    </Script>
  );
};

export default ClarityScript;
