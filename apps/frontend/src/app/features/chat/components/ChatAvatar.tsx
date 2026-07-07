import clsx from 'clsx';
import { LuUsers } from 'react-icons/lu';
import { accentFor, initialsOf } from '@/app/features/chat/components/chatAvatarUtils';

/**
 * Token-based avatar for chat. Renders deterministic colored initials (no
 * hardcoded hex), or a group glyph. Used by the conversation rows, the channel
 * header, and the colleague directory.
 */

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
