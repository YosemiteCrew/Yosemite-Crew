import clsx from 'clsx';
import { IoBusinessOutline, IoPeopleOutline } from 'react-icons/io5';
import { accentFor, initialsOf } from '@/app/features/chat/components/chatAvatarUtils';

/**
 * Token-based avatar for chat. Renders deterministic colored initials (no
 * hardcoded hex), a group glyph, or a clinic/business glyph for across-the-
 * network rows. Used by the conversation rows, the channel header, and the
 * colleague / network directories.
 */

const SIZE = {
  xs: 'size-[26px] text-[9.5px]',
  sm: 'size-9 text-xs',
  // Conversation-row avatar: 36px on tablet, 40px on the wide desktop frame.
  row: 'size-9 text-xs xl:size-10 xl:text-[13px]',
  md: 'h-11 w-11 text-sm',
  lg: 'size-12 text-base',
} as const;

const GLYPH_SIZE = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  row: 'h-4 w-4 xl:h-[17px] xl:w-[17px]',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export type ChatAvatarProps = Readonly<{
  name: string;
  online?: boolean;
  group?: boolean;
  /** Renders a rounded-square blue clinic glyph (across-the-network clinics). */
  business?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}>;

export function ChatAvatar({
  name,
  online,
  group,
  business,
  size = 'md',
  className,
}: ChatAvatarProps) {
  const isGlyph = group || business;
  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      <span
        className={clsx(
          'inline-flex items-center justify-center font-satoshi font-bold',
          SIZE[size],
          business
            ? 'rounded-[12px] bg-[var(--blue-soft)] text-[var(--blue-text)]'
            : 'rounded-full',
          !business && (group ? 'bg-[var(--band)] text-[var(--ink-muted)]' : accentFor(name))
        )}
      >
        {business ? (
          <IoBusinessOutline className={GLYPH_SIZE[size]} aria-hidden="true" />
        ) : (
          !isGlyph && initialsOf(name)
        )}
        {group && <IoPeopleOutline className={GLYPH_SIZE[size]} aria-hidden="true" />}
      </span>
      {online && (
        <span className="chat-presence-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--screen-2)] bg-[var(--success)]" />
      )}
    </span>
  );
}

export default ChatAvatar;
