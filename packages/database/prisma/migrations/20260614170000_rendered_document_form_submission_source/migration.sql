-- Add rendered document source support for legacy form submission bridge.
ALTER TYPE "RenderedDocumentSourceKind" ADD VALUE IF NOT EXISTS 'FORM_SUBMISSION';
