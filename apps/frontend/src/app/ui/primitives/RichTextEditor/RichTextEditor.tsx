'use client';
import React, { useEffect, useId, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import FloatingToolbar from '@/app/ui/primitives/RichTextEditor/FloatingToolbar';
import { isRichTextEmpty, sanitizeRichText } from '@/app/lib/richText';
import './RichTextEditor.css';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  ariaLabel: string;
};

/**
 * Shared rich-text editor (Tiptap) matching the SOAP editor in the
 * "PIMS - Appointments" design: an editable field carries the recessed
 * `--field-bg` surface with a 1.5px hairline border and 12px radius; on focus it
 * gains a blue border + glow and reveals a docked B/I/U/list/indent toolbar bar.
 * Emits sanitized HTML so the value can be stored and sent to the backend as-is.
 * In `readOnly` mode the surface and toolbar are dropped so a saved note never
 * reads as an editable field.
 */
const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  ariaLabel,
}: RichTextEditorProps) => {
  const labelId = useId();

  // Always hold the latest onChange so onUpdate stays current WITHOUT listing it
  // as a useEditor recreation dep — a fresh inline handler (or a new controlled
  // `value`) must not destroy and rebuild the editor, which reset DOM focus and
  // the cursor after a single keystroke (the reported bug).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Create the editor ONCE (no dependency array) so it stays mounted across
  // keystrokes, preserving focus, cursor, and Enter behaviour.
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    // Tiptap packages are resolved from two adjacent 3.x minors in this repo.
    // Cast the extension list locally so the editor config stays type-safe
    // enough for the app while avoiding cross-minor type incompatibility.
    extensions: [StarterKit.configure({ underline: false }), Underline] as never,
    content: value || '',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        'aria-readonly': String(readOnly),
        // Font, colour, and list styling live in RichTextEditor.css so the text
        // colour tracks the theme via a live var(--ink-body).
        class: 'yc-rte-content',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(sanitizeRichText(instance.getHTML()));
    },
  });

  // Reflect external `value` changes (parent resets, template prefills) without
  // clobbering the user's own typing. Comparing against the sanitized current
  // HTML means echoing back our own keystroke is a no-op, so the cursor is never
  // moved by re-setting identical content.
  useEffect(() => {
    if (!editor) return;
    if (value !== sanitizeRichText(editor.getHTML())) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  // readOnly is no longer a recreation dep, so toggle editability imperatively.
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const label = (
    <span id={labelId} className="sr-only">
      {ariaLabel}
    </span>
  );

  // Read-only note: bare content, no field surface, no toolbar.
  if (readOnly) {
    return (
      <div className="yc-rte-readonly">
        {label}
        <EditorContent editor={editor} />
      </div>
    );
  }

  const showPlaceholder = placeholder && isRichTextEmpty(value);

  return (
    <div>
      {label}
      <div className="yc-rte-field">
        {editor && <FloatingToolbar editor={editor} />}
        <div className="yc-rte-body">
          {showPlaceholder && (
            <span aria-hidden="true" className="yc-rte-placeholder">
              {placeholder}
            </span>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;
