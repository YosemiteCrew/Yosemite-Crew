'use client';
import React, { useEffect, useId } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import FloatingToolbar from '@/app/ui/primitives/RichTextEditor/FloatingToolbar';
import { sanitizeRichText } from '@/app/lib/richText';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  ariaLabel: string;
  className?: string;
  /**
   * `title` floats the toolbar up into the wrapping section's title row (used
   * when the editor is the first element in the section). `inline` keeps it at
   * the top-right of the editor and reserves space above the text. `inset`
   * pins a chromeless toolbar to the editor's top-right corner *inside* the
   * section and reserves right-hand width on the first lines so the text never
   * runs under it (the SOAP section design).
   */
  toolbarPlacement?: 'title' | 'inline' | 'inset';
};

/**
 * Shared rich-text editor (Tiptap) with a floating B/I/U/list/indent toolbar.
 * Emits sanitized HTML so the value can be stored and sent to the backend as-is.
 * In `readOnly` mode the toolbar is hidden and the content is not editable.
 */
const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  ariaLabel,
  className,
  toolbarPlacement = 'title',
}: RichTextEditorProps) => {
  const labelId = useId();

  const isInset = toolbarPlacement === 'inset';
  // Inset toolbar sits inside the top-right corner — reserve right room on the
  // first line(s) so the text never runs under it.
  const contentPadding = isInset ? 'pr-52' : 'pr-0';

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [StarterKit.configure({ underline: false }), Underline],
    content: value || '',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        'aria-readonly': String(readOnly),
        class: `yc-rte-content min-h-[88px] ${contentPadding} outline-none text-body-4 text-text-primary leading-[150%] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:min-h-5`,
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(sanitizeRichText(instance.getHTML()));
    },
  });

  // Keep editability in sync when the readOnly prop flips (e.g. view-only lock).
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Sync external value into the editor only when it actually diverges
  // (canonical Tiptap controlled pattern — avoids a render loop).
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  const showPlaceholder = !readOnly && placeholder && editor?.isEmpty;
  // `title` overlaps the section title row (no reserved space); `inline` keeps
  // the toolbar inside the editor and reserves room above the first text line;
  // `inset` pins the pill toolbar to the top-right of the editor's content area
  // (it sits below the section border, on the same band as the first text line),
  // and the text starts at the very top-left of that band.
  const isInline = toolbarPlacement === 'inline';
  // `inline`/`inset` pin the toolbar at the top-right of the content area;
  // `title` floats it up over the section title row instead.
  const toolbarPosition = isInline || isInset ? 'top-0 right-0' : '-top-12 right-0';

  // Inset: a small top padding keeps the first text line off the container edge
  // while still starting it high, roughly aligned with the top of the toolbar
  // pill (the text clears the pill horizontally via the `pr-52` reserve).
  const insetContentClass = isInset ? 'min-h-22 [&_.yc-rte-content]:pt-1' : 'min-h-22';

  return (
    <div className={className}>
      <span id={labelId} className="sr-only">
        {ariaLabel}
      </span>
      <div className={`relative ${insetContentClass} ${!readOnly && isInline ? 'pt-12' : ''}`}>
        {/* Toolbar floats over the top-right corner; the text starts top-left. */}
        {!readOnly && editor && (
          <div className={`absolute z-10 ${toolbarPosition}`}>
            <FloatingToolbar editor={editor} />
          </div>
        )}
        {showPlaceholder && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 text-body-4 text-text-secondary ${isInline ? 'top-12' : 'top-1'} ${isInset ? 'pr-52' : ''}`}
          >
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
