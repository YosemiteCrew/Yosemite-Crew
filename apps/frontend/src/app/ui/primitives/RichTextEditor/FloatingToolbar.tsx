import React from 'react';
import type { Editor } from '@tiptap/react';
import { FaBold, FaItalic, FaUnderline, FaListUl, FaIndent } from 'react-icons/fa6';

type FloatingToolbarProps = {
  editor: Editor;
};

type ToolButton = {
  key: string;
  label: string;
  icon: React.ReactNode;
  isActive: () => boolean;
  run: () => void;
};

/**
 * Floating B / I / U / bulleted-list / indent toolbar for the rich text editor.
 * "Indent" sinks list items when possible; otherwise it inserts visible
 * indentation into the current text block so the control always has an effect.
 */
const FloatingToolbar = ({ editor }: FloatingToolbarProps) => {
  const buttons: ToolButton[] = [
    {
      key: 'bold',
      label: 'Bold',
      icon: <FaBold aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      label: 'Italic',
      icon: <FaItalic aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      label: 'Underline',
      icon: <FaUnderline aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'bulletList',
      label: 'Bulleted list',
      icon: <FaListUl aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'indent',
      label: 'Indent',
      icon: <FaIndent aria-hidden="true" size={14} />,
      isActive: () => false,
      run: () => {
        // Inside a list, indenting sinks the list item.
        if (editor.isActive('listItem') && editor.chain().focus().sinkListItem('listItem').run()) {
          return;
        }
        // Otherwise prepend indentation at the start of the current block so the
        // selected text is pushed right rather than replaced (insertContent would
        // overwrite the selection). Insert at the block start of the selection
        // anchor, then re-place the selection shifted right by the inserted
        // spaces so the user's selection/cursor is preserved.
        const indent = '\u00a0\u00a0\u00a0\u00a0';
        const { from, to, $from } = editor.state.selection;
        const blockStart = $from.start();
        editor
          .chain()
          .focus()
          .insertContentAt(blockStart, indent)
          .setTextSelection({ from: from + indent.length, to: to + indent.length })
          .run();
      },
    },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-neutral-100 px-5 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
    >
      {buttons.map((btn) => (
        <button
          key={btn.key}
          type="button"
          aria-label={btn.label}
          aria-pressed={btn.isActive()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={btn.run}
          className={`flex size-6 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
            btn.isActive() ? 'text-text-brand' : 'text-neutral-700 hover:text-text-primary'
          }`}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
};

export default FloatingToolbar;
