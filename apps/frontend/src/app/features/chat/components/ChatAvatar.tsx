import clsx from 'clsx';
import { LuUsers } from 'react-icons/lu';

/**
 * Token-based avatar for chat. Renders deterministic colored initials (no
 * hardcoded hex), or a group glyph. Used by the conversation rows, the channel
 * header, and the colleague directory.
 */

const AVATAR_ACCENTS = [
  'bg-primary-100 text-primary-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-danger-100 text-danger-700',
  'bg-brand-100 text-brand-950',
  'bg-neutral-200 text-neutral-700',
] as const;

/** Deterministic palette index from a stable seed, so a person keeps one color. */
export const accentFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + (seed.codePointAt(i) ?? 0)) >>> 0;
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length];
};

/** Up to two uppercase initials, ignoring any "(owner)" suffix. */
export const initialsOf = (name: string): string => {
  const initials = name
    .split('(')[0]
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
};

const SIZE = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

export type ChatAvatarProps = Readonly<{
  name: string;
  online?: boolean;
  group?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}>;

export function ChatAvatar({ name, online, group, size = 'md', className }: ChatAvatarProps) {
  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      <span
        className={clsx(
          'inline-flex items-center justify-center rounded-full font-satoshi font-bold',
          SIZE[size],
          group ? 'bg-chat-panel text-primary-600' : accentFor(name)
        )}
      >
        {group ? <LuUsers className="h-5 w-5" /> : initialsOf(name)}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-0 bg-success-bright" />
      )}
    </span>
  );
}

export default ChatAvatar;
