'use strict';

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AuditLog, AuditEntry } from './audit-log';
import type { ControlledSubstanceLogbook, CsTransaction } from './controlled-substance';

export interface WasteEvent {
  id: string;
  timestamp: number;
  drugName: string;
  drugClass: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  veterinarianId: string;
  veterinarianName: string;
  witnessId: string;
  witnessName: string;
  witnessPinVerified: boolean;
  reason: string;
  csTransactionId: string;
}

export interface DualWitnessLog {
  recordWaste: (
    event: Omit<WasteEvent, 'id' | 'timestamp' | 'csTransactionId' | 'witnessPinVerified'> & {
      witnessPin: string;
    }
  ) => WasteEvent;
  verifyWitnessPin: (witnessId: string, pin: string) => boolean;
  getWasteEvents: (drugName?: string) => WasteEvent[];
  /** Waste events whose witness proved their identity. Never inferred. */
  getVerifiedWasteEvents: (drugName?: string) => WasteEvent[];
  getWasteByWitness: (witnessId: string) => WasteEvent[];
  setWitnessPin: (witnessId: string, witnessName: string, pin: string) => void;
  hasWitness: (witnessId: string) => boolean;
  /**
   * The enrolled account for an id, so a caller's claimed witness name can be
   * replaced with the canonical one. A PIN proves an account, never a name.
   */
  getWitnessAccount: (witnessId: string) => { id: string; name: string } | null;
}

interface DualWitnessDeps {
  logbook: ControlledSubstanceLogbook;
  /**
   * The signed side of the record. The logbook file is not HMAC-protected, so
   * its `witnessPinVerified` flag can be edited on disk; the audit entry
   * carrying the same flag cannot be, without invalidating its signature.
   * Verification is read from there. Omitting this means nothing can be proved
   * witness-verified, which is the correct answer rather than a lenient one.
   */
  auditLog?: AuditLog;
  now?: () => number;
  generateId?: () => string;
}

interface WitnessAccount {
  id: string;
  name: string;
  pinHash: string;
}

let dwCounter = 0;
const defaultId = (): string => `waste-${Date.now()}-${++dwCounter}`;

// Salted scrypt hashing for witness PINs. The dual-witness check is a DEA
// control, so the stored value must not be brute-forceable or collidable (the
// previous 32-bit string hash was both). Stored as "<saltHex>:<hashHex>".
const PIN_KEYLEN = 32;
const makePinHash = (pin: string): string => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, PIN_KEYLEN).toString('hex')}`;
};
const verifyPinHash = (pin: string, stored: string): boolean => {
  const [saltHex = '', hashHex = ''] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), PIN_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// A waste transaction read back from the logbook reports what was actually
// verified when it was recorded. The previous version hardcoded
// `witnessPinVerified: true`, so a destruction recorded with no witness at all
// read back as witness-verified and was counted as a witnessed waste event in
// the PMP dialog: an affirmative false compliance statement on the normal path.
const txToWasteEvent = (tx: CsTransaction, witnessPinVerified: boolean): WasteEvent => ({
  id: tx.id,
  timestamp: tx.timestamp,
  drugName: tx.drugName,
  drugClass: tx.drugClass,
  lotNumber: tx.lotNumber,
  quantity: tx.quantity,
  unit: tx.unit,
  veterinarianId: tx.veterinarianId,
  veterinarianName: tx.veterinarianName,
  witnessId: tx.witnessId || '',
  witnessName: tx.witnessName || '',
  witnessPinVerified,
  reason: tx.notes || '',
  csTransactionId: tx.id,
});

export const createDualWitnessLog = (deps: DualWitnessDeps): DualWitnessLog => {
  const now = deps.now || (() => Date.now());
  const generateId = deps.generateId || defaultId;
  const witnesses = new Map<string, WitnessAccount>();

  const setWitnessPin = (witnessId: string, witnessName: string, pin: string): void => {
    witnesses.set(witnessId, {
      id: witnessId,
      name: witnessName,
      pinHash: makePinHash(pin),
    });
  };

  const verifyWitnessPin = (witnessId: string, pin: string): boolean => {
    const account = witnesses.get(witnessId);
    if (!account) return false;
    return verifyPinHash(pin, account.pinHash);
  };

  const recordWaste = (
    input: { witnessPin: string } & Omit<
      WasteEvent,
      'id' | 'timestamp' | 'csTransactionId' | 'witnessPinVerified'
    >
  ): WasteEvent => {
    const pinVerified = verifyWitnessPin(input.witnessId, input.witnessPin);
    const buildEvent = (witnessPinVerified: boolean, csTransactionId: string): WasteEvent => ({
      id: generateId(),
      timestamp: now(),
      drugName: input.drugName,
      drugClass: input.drugClass,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      unit: input.unit,
      veterinarianId: input.veterinarianId,
      veterinarianName: input.veterinarianName,
      witnessId: input.witnessId,
      witnessName: input.witnessName,
      witnessPinVerified,
      reason: input.reason,
      csTransactionId,
    });

    if (!pinVerified) {
      // Reject before touching inventory: an unverified or missing witness must not
      // produce a controlled-substance waste transaction (which would decrement stock
      // and later read back via getWasteEvents() as a compliant, verified record).
      return buildEvent(false, '');
    }

    const csTx = deps.logbook.record({
      action: 'waste',
      drugName: input.drugName,
      drugClass: input.drugClass,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      unit: input.unit,
      veterinarianId: input.veterinarianId,
      veterinarianName: input.veterinarianName,
      witnessId: input.witnessId,
      witnessName: input.witnessName,
      witnessPinVerified: true,
    });

    return buildEvent(pinVerified, csTx.id);
  };

  /**
   * Reads verification from the signed audit entry, not from the logbook file.
   * Editing `controlled-substance-log.jsonl` to set witnessPinVerified: true
   * leaves the audit entry untouched, so the two disagree and this returns
   * false - where trusting the logbook value would have reported the forged
   * record as witness-verified in the PMP dialog.
   *
   * What this CANNOT do, and what it therefore depends on: a signature only
   * proves this app signed the entry, never that a witness authenticated.
   * Anyone able to make the app sign an attestation can produce one that
   * satisfies every check below. The real control is that the app must never
   * sign `witnessPinVerified: true` for a verification it did not perform,
   * which is why `yc:audit-append` refuses controlled-substance entries and
   * leaves the record path as the only writer. Weaken that and these checks
   * become decoration.
   *
   * What the checks below do add is that an entry cannot be repurposed: it must
   * name this transaction and this witness, so a genuine attestation belonging
   * to another record is useless to a forger.
   */
  const verifiedFromAuditTrail = (): ((tx: CsTransaction) => boolean) => {
    if (!deps.auditLog) return () => false;
    const auditLog = deps.auditLog;
    const byId = new Map<string, AuditEntry>();
    for (const entry of auditLog.query({ resourceType: 'controlled-substance' })) {
      byId.set(entry.id, entry);
    }
    return (tx) => {
      const entry = byId.get(tx.auditEntryId);
      if (!entry) return false;
      // `isAuditEntry` only checks id and action, so a malformed or tampered row
      // can reach here with no details at all. Dereferencing it would throw and
      // take the whole PMP dialog down instead of reporting one record as
      // unverified.
      const details = entry.details;
      if (typeof details !== 'object' || details === null) return false;
      // The entry must be the one for THIS transaction, so a forged flag cannot
      // borrow a genuinely verified entry belonging to another record.
      if (details.csTransactionId !== tx.id) return false;
      // ...and it must name the same witness. Swapping only the logbook's
      // witnessId leaves the signed entry valid, which would otherwise let
      // getWasteByWitness() report a different person as the verified witness.
      if ((details.witnessId ?? '') !== (tx.witnessId ?? '')) return false;
      if (details.witnessPinVerified !== true) return false;
      return auditLog.verify(entry);
    };
  };

  const getWasteEvents = (drugName?: string): WasteEvent[] => {
    const txs = drugName ? deps.logbook.getByDrug(drugName) : deps.logbook.getTransactions();
    const isVerified = verifiedFromAuditTrail();
    return txs.filter((tx) => tx.action === 'waste').map((tx) => txToWasteEvent(tx, isVerified(tx)));
  };

  const getVerifiedWasteEvents = (drugName?: string): WasteEvent[] =>
    getWasteEvents(drugName).filter((e) => e.witnessPinVerified);

  const getWasteByWitness = (witnessId: string): WasteEvent[] => {
    const txs = deps.logbook.getTransactions();
    const isVerified = verifiedFromAuditTrail();
    return txs
      .filter((tx) => tx.action === 'waste' && tx.witnessId === witnessId)
      .map((tx) => txToWasteEvent(tx, isVerified(tx)));
  };

  return {
    recordWaste,
    verifyWitnessPin,
    getWasteEvents,
    getVerifiedWasteEvents,
    getWasteByWitness,
    setWitnessPin,
    hasWitness: (witnessId: string): boolean => witnesses.has(witnessId),
    getWitnessAccount: (witnessId: string): { id: string; name: string } | null => {
      const account = witnesses.get(witnessId);
      return account ? { id: account.id, name: account.name } : null;
    },
  };
};
