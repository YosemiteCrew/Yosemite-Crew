import React from 'react';
import type { Editor } from '@tiptap/react';
import { IoListOutline } from 'react-icons/io5';
import { FaBold, FaItalic, FaUnderline, FaIndent } from 'react-icons/fa6';

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

const renderButton = (btn: ToolButton) => (
  <button
    key={btn.key}
    type="button"
    aria-label={btn.label}
    aria-pressed={btn.isActive()}
    onMouseDown={(e) => e.preventDefault()}
    onClick={btn.run}
    className="yc-rte-tool-btn"
  >
    {btn.icon}
  </button>
);

/**
 * Docked B / I / U | bulleted-list / indent toolbar for the rich text editor.
 * Rendered as a top bar inside the field (see RichTextEditor.css `.yc-rte-toolbar`,
 * which reveals it on focus) — the design's active-SOAP-field treatment. "Indent"
 * sinks list items when possible; otherwise it inserts visible indentation into
 * the current text block so the control always has an effect.
 */
const FloatingToolbar = ({ editor }: FloatingToolbarProps) => {
  const buttons: ToolButton[] = [
    {
      key: 'bold',
      label: 'Bold',
      icon: <FaBold aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleMark('bold').run(),
    },
    {
      key: 'italic',
      label: 'Italic',
      icon: <FaItalic aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleMark('italic').run(),
    },
    {
      key: 'underline',
      label: 'Underline',
      icon: <FaUnderline aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('underline'),
      run: () => editor.chain().focus().toggleMark('underline').run(),
    },
    {
      key: 'bulletList',
      label: 'Bulleted list',
      icon: <IoListOutline aria-hidden="true" size={14} />,
      isActive: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleList('bulletList', 'listItem').run(),
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

  // B / I / U, a hairline divider, then the list + indent controls — the design's
  // grouping. The trailing "editing" hint mirrors the active-field affordance.
  const [bold, italic, underline, ...blockButtons] = buttons;

  return (
    <div role="toolbar" aria-label="Text formatting" className="yc-rte-toolbar">
      {[bold, italic, underline].map(renderButton)}
      <span className="yc-rte-toolbar-divider" aria-hidden="true" />
      {blockButtons.map(renderButton)}
      <span className="yc-rte-toolbar-hint" aria-hidden="true">
        editing
      </span>
    </div>
  );
};

export default FloatingToolbar;
