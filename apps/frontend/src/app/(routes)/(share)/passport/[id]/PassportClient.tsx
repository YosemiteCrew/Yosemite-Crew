'use client';

import { useEffect, useState } from 'react';
import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { useTheme, type Theme } from '@/app/ui/theme';
import PublicPassportView from './PublicPassportView';
import { getPublicPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

type PassportClientProps = { id: string };
type LoadState = 'loading' | 'ready' | 'unavailable';

const PassportClient = ({ id }: PassportClientProps) => {
  const [passport, setPassport] = useState<PetPassportDTO | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  // The reader's resolved theme, read through useSyncExternalStore rather than
  // off the DOM in a state initialiser. That earlier version was a hydration
  // bug: the server has no `document`, so it rendered light and emitted the moon
  // icon, while the client initialised dark - a mismatched tree React 19 has to
  // throw away and regenerate. `useTheme` exists for exactly this and supplies a
  // server snapshot, so both passes agree.
  const { theme: resolvedTheme } = useTheme();

  // The page keeps its own sun/moon control, so the reader can flip just this
  // passport without changing their preference everywhere. null means "no local
  // override yet - follow the phone", which is why this starts from the theme
  // rather than from a hardcoded 'light'.
  const [override, setOverride] = useState<Theme | null>(null);
  const theme: Theme = override ?? resolvedTheme;

  useEffect(() => {
    let active = true;
    getPublicPassport(id)
      .then((data) => {
        if (!active) return;
        setPassport(data);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => {
      active = false;
    };
  }, [id]);

  const toggleTheme = () => setOverride(theme === 'dark' ? 'light' : 'dark');

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-wb-theme={theme}
      className="yc-warmbone flex min-h-screen w-full flex-col items-center px-4 py-10"
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle light or dark theme"
        className="fixed right-5 top-5 z-10 flex size-11 items-center justify-center rounded-full text-[19px]"
        style={{
          background: 'var(--glass-93)',
          border: '1px solid var(--hairline-soft)',
          boxShadow: '0 6px 20px var(--sh10)',
          color: 'var(--ink-body)',
          // 8px, not 24px: backdrop blur cost scales with radius and this sits on a
          // fixed element, so it composites on every scroll of the passport page.
          // --glass-93 is 93% opaque, so almost none of the blur was visible anyway.
          backdropFilter: 'blur(8px)',
        }}
      >
        {theme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
      </button>

      <div className="flex w-full max-w-md flex-1 flex-col justify-center">
        {state === 'loading' && (
          <p className="text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Loading pet passport...
          </p>
        )}
        {state === 'unavailable' && (
          <p className="text-center text-[12px]" style={{ color: 'var(--ink)' }}>
            This passport could not be found.
          </p>
        )}
        {state === 'ready' && passport && <PublicPassportView passport={passport} />}
      </div>
    </main>
  );
};

export default PassportClient;
