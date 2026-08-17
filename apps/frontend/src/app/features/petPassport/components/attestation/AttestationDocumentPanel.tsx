'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { IoDocumentTextOutline, IoOpenOutline } from 'react-icons/io5';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { loadDocumentDownloadURL } from '@/app/features/companions/services/companionDocumentService';
import type { SignedFile } from '@/app/features/documents/types/companionDocuments';

type AttestationDocumentPanelProps = {
  documentId?: string;
  /** Names the file in the open action so the label is unambiguous. */
  title: string;
  /** Raised once the vet has opened a file, so the caller can track review. */
  onOpenFile: () => void;
};

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

type LoadedFiles = { documentId: string; files: SignedFile[] };

/** What to show for the current document, from whichever result belongs to it. */
const resolveView = (
  documentId: string | undefined,
  loaded: LoadedFiles | null,
  failedId: string | null
): { state: LoadState; files: SignedFile[] } => {
  if (!documentId) return { state: 'unavailable', files: [] };
  if (failedId === documentId) return { state: 'error', files: [] };
  if (loaded?.documentId !== documentId) return { state: 'loading', files: [] };
  return { state: loaded.files.length > 0 ? 'ready' : 'unavailable', files: loaded.files };
};

const isImageFile = (file: SignedFile): boolean => Boolean(file.mimeType?.startsWith('image/'));

/** "PDF document", "TIFF document", ... for the tile of a file we cannot frame. */
const getFileKindLabel = (file: SignedFile): string => {
  const kind = file.mimeType?.split('/').pop()?.toUpperCase();
  return kind ? `${kind} document` : 'Document';
};

const openInNewTab = (url: string) => {
  globalThis.open(url, '_blank', 'noopener');
};

const PANEL_CLASS =
  'flex min-h-45 flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--screen)] p-3.5';

const CAPTION_CLASS = 'text-[11.5px] text-[var(--ink-faint)]';

const FilePreview = ({
  file,
  index,
  title,
  onOpen,
}: {
  file: SignedFile;
  index: number;
  title: string;
  onOpen: (url: string) => void;
}) => {
  const label = `Open ${title}${index > 0 ? ` (file ${index + 1})` : ''}`;
  return (
    <div className="flex flex-col gap-2">
      {isImageFile(file) ? (
        <Image
          src={file.url}
          alt={`Uploaded document: ${title}`}
          width={640}
          height={480}
          unoptimized
          className="max-h-56 w-full rounded-[10px] border border-[var(--hairline)] object-contain"
        />
      ) : (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--hairline)] bg-[var(--inset)] px-3 py-3">
          <span
            aria-hidden="true"
            className="grid size-9 flex-none place-items-center rounded-[10px] bg-[var(--blue-soft)] text-[var(--blue-text)]"
          >
            <IoDocumentTextOutline size={17} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] font-bold text-[var(--ink)]">{title}</span>
            <span className={CAPTION_CLASS}>{getFileKindLabel(file)}</span>
          </span>
        </div>
      )}
      <Secondary
        size="small"
        text="Open document"
        ariaLabel={label}
        icon={<IoOpenOutline aria-hidden="true" />}
        onClick={() => onOpen(file.url)}
      />
    </div>
  );
};

const PanelMessage = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] text-[var(--ink-body)]">{children}</p>
);

/**
 * The uploaded file itself, beside the parsed fields, so the vet attests what
 * they can actually see. Images render inline; every other type (a scanned PDF
 * certificate, most often) opens in a new tab, because the app's CSP allows
 * those signed storage URLs as images but not as frames.
 */
const AttestationDocumentPanel = ({
  documentId,
  title,
  onOpenFile,
}: AttestationDocumentPanelProps) => {
  // Both results are keyed by the document they belong to, so the view state is
  // derived during render rather than reset by a second effect: a panel opened
  // on another document reads as loading again without an extra pass.
  const [loaded, setLoaded] = useState<LoadedFiles | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    loadDocumentDownloadURL(documentId)
      .then((signed) => {
        if (!cancelled) setLoaded({ documentId, files: signed });
      })
      .catch(() => {
        if (!cancelled) setFailedId(documentId);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const { state, files } = resolveView(documentId, loaded, failedId);

  const handleOpen = (url: string) => {
    openInNewTab(url);
    onOpenFile();
  };

  return (
    <section aria-label="Uploaded document" className={PANEL_CLASS}>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        Uploaded document
      </h3>
      {state === 'loading' && (
        <div className="h-32 animate-pulse rounded-[10px] bg-card-hover" aria-hidden="true" />
      )}
      {state === 'error' && (
        <PanelMessage>
          This file could not be loaded. Do not attest a record you cannot read.
        </PanelMessage>
      )}
      {state === 'unavailable' && (
        <PanelMessage>
          No file is attached to this record, so there is nothing to read.
        </PanelMessage>
      )}
      {state === 'ready' &&
        files.map((file, index) => (
          <FilePreview key={file.key} file={file} index={index} title={title} onOpen={handleOpen} />
        ))}
    </section>
  );
};

export default AttestationDocumentPanel;
