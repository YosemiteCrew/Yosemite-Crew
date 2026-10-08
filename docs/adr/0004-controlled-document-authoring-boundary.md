# ADR 0004: Separate authoring sessions from controlled document versions

## Status

Accepted

## Context

Controlled documents need simultaneous browser editing while preserving an immutable version history. Editor working state changes frequently, may use a deployer-specific format, and is not eligible for review, approval, or signature until the authoring session closes.

Check-out/check-in and browser co-authoring must also be mutually exclusive. Separate lock implementations could allow both modes to edit the same document at once.

## Decision

Store mutable editor state in `AuthoringSession` and admit it to the controlled lifecycle only when the session closes. `ControlledDocumentVersion` remains immutable and records lineage, contributor attribution, and the regenerated rendition.

Use one `DocumentAuthoringLock` row per controlled document for both check-out and co-authoring. Opening a session takes that lock, and closing a session verifies that its base is still the latest version before creating one next minor version and releasing the lock in the same serializable transaction.

Keep editor synchronization and rendition generation behind adapters. Database records carry provider identifiers and provider-neutral state without making a specific editor or synchronization format part of the controlled-document contract.

## Consequences

- Working state cannot be mistaken for an approved or effective version.
- Check-out and co-authoring cannot overlap on one document.
- Closing a session is replay-safe and produces at most one controlled version.
- Editor providers can change without rewriting version lineage.
- Comments, tracked changes, review rounds, templates, and dossier bindings can attach to either the mutable session or immutable version according to their lifecycle.
